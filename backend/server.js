/**
 * server.js
 * Simple site -> LLM-ready Markdown API
 *
 * GET /?url=<page_url>&render=<true|false>&target_words=<num>&raw=<true|false>
 *
 * Example:
 *  curl -s "http://localhost:5600/?url=https://castler.com&render=true"
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { chromium } = require('playwright');
const cors = require('cors');
const fetch =
  globalThis.fetch ||
  ((...args) => import('node-fetch').then((m) => m.default(...args)));
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const robotsParser = require('robots-parser');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 5600;
const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://websitescrapper.onrender.com'],
  })
);

const PAGE_TIMEOUT = 20000;
const BROWSER_LAUNCH_OPTIONS = { headless: true };

// cwd gets current working directory and then add / or \ as per mac of window to add cache to that
const CACHE_DIR = path.join(process.cwd(), 'cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Rate limiter
const limiter = rateLimit({
  windowMs: 30 * 1000, // 30s
  max: 10, // max requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Keep a single browser instance
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch(BROWSER_LAUNCH_OPTIONS);
  }
  return browserPromise;
}

function sha256hex(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}
function isoNow() {
  return new Date().toISOString();
}

async function fetchRobotsTxt(url) {
  try {
    const u = new URL(url);
    const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
    const res = await fetch(robotsUrl, { timeout: 5000 });
    const txt = await res.text();
    return robotsParser(robotsUrl, txt);
  } catch (e) {
    return null;
  }
}

async function politeToCrawl(url) {
  const rp = await fetchRobotsTxt(url);
  if (!rp) return true;
  return rp.isAllowed(url, 'site2md-api') || rp.isAllowed(url, '*');
}

async function fetchPage(
  url,
  { renderJS = true, timeout = PAGE_TIMEOUT } = {}
) {
  if (!renderJS) {
    // fast fetch
    const res = await fetch(url, { timeout });
    const text = await res.text();
    return { html: text, finalUrl: res.url, status: res.status, headers: {} };
  }
  const browser = await getBrowser();
  const context = await (
    await browser
  ).newContext({
    userAgent: 'site2md-api (+https://localhost)',
    viewport: { width: 1200, height: 800 },
  });
  const page = await context.newPage();
  try {
    const resp = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout,
    });
    // small wait to allow lazy content
    await page.waitForTimeout(300);
    const html = await page.content();
    const finalUrl = page.url();
    await page.close();
    await context.close();
    return { html, finalUrl, status: resp ? resp.status() : 200, headers: {} };
  } catch (err) {
    try {
      await page.close();
    } catch (_) {}
    try {
      await context.close();
    } catch (_) {}
    throw err;
  }
}

function extractMain(html, url) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const reader = new Readability(doc);
  const article = reader.parse(); // title, byline, content(html), excerpt
  return article;
}

function htmlToMarkdown(html) {
  const turndown = new TurndownService({ codeBlockStyle: 'fenced' });
  return turndown.turndown(html);
}

function addFrontmatter(md, meta) {
  const escape = (s) => (s || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
  const fm = [
    '---',
    `title: "${escape(meta.title || '')}"`,
    `url: "${meta.url}"`,
    `domain: "${meta.domain}"`,
    `crawled_at: "${meta.crawled_at}"`,
    `content_hash: "${meta.content_hash}"`,
    `excerpt: "${escape(meta.excerpt || '')}"`,
    '---',
    '',
  ].join('\n');
  return fm + md;
}

// Simple chunker: split by headings / paragraphs and target words
function chunkMarkdown(md, opts = { target_words: 1000, overlap_words: 150 }) {
  const parts = md.split(/\n(?=#)|\n{2,}/g);
  const chunks = [];
  let cur = '';
  let curWords = 0;
  const pushCur = () => {
    if (cur.trim()) {
      chunks.push({ text: cur.trim(), words: curWords });
    }
    cur = '';
    curWords = 0;
  };
  for (const p of parts) {
    const w = p.split(/\s+/).filter(Boolean).length;
    if (curWords + w > opts.target_words && curWords > 0) {
      pushCur();
      const curWordsArr = cur.split(/\s+/);
      const overlap = curWordsArr.slice(-opts.overlap_words).join(' ');
      cur = overlap + '\n\n' + p;
      curWords = overlap.split(/\s+/).filter(Boolean).length + w;
    } else {
      cur += '\n\n' + p;
      curWords += w;
    }
  }
  pushCur();
  return chunks.map((c, i) => ({
    chunk_index: i,
    text: c.text,
    approx_words: c.words,
  }));
}

// Simple filesystem cache: key -> cached file
function cacheGet(key) {
  const fname = path.join(CACHE_DIR, key + '.json');
  if (fs.existsSync(fname)) {
    try {
      const raw = fs.readFileSync(fname, 'utf8');
      return JSON.parse(raw);
    } catch (e) {}
  }
  return null;
}
function cacheSet(key, obj) {
  const fname = path.join(CACHE_DIR, key + '.json');
  try {
    fs.writeFileSync(fname, JSON.stringify(obj, null, 2), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

// API route
app.get('/', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).json({
      error: 'Missing url query parameter. e.g. /?url=https://example.com',
    });
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  console.log('Processing', url);
  // politeness / robots check
  try {
    const ok = await politeToCrawl(url);
    if (!ok) {
      return res.status(403).json({ error: 'Blocked by robots.txt' });
    }
  } catch (e) {
    // ignore robots errors but log
    console.warn('robots check failed:', e?.message || e);
  }

  const render = String(req.query.render || 'true').toLowerCase() !== 'false'; // default true
  const target_words = parseInt(req.query.target_words || '1000', 10) || 1000;
  const raw = String(req.query.raw || 'false').toLowerCase() === 'true';

  try {
    // If cached and unchanged, return from cache
    const cacheKey = sha256hex(
      url + '|' + (render ? 'r' : 'n') + '|' + target_words
    );
    const cached = cacheGet(cacheKey);
    if (cached) {
      // quickly return
      if (raw) {
        res.setHeader('content-type', 'text/markdown; charset=utf-8');
        return res.status(200).send(cached.md);
      } else {
        return res.status(200).json(cached.json);
      }
    }

    const fetched = await fetchPage(url, {
      renderJS: render,
      timeout: PAGE_TIMEOUT,
    });
    const article = extractMain(fetched.html, fetched.finalUrl || url);
    if (!article || !article.content) {
      // fallback: convert full body
      const dom = new JSDOM(fetched.html, { url: fetched.finalUrl || url });
      article = {
        title: dom.window.document.title || '',
        content: dom.window.document.body
          ? dom.window.document.body.innerHTML
          : '',
        excerpt: '',
      };
      if (!article.content) {
        return res.status(422).json({ error: 'Could not extract content' });
      }
    }

    const mdContent = htmlToMarkdown(article.content);
    const contentHash = sha256hex(mdContent);
    const meta = {
      title: article.title || '',
      url: fetched.finalUrl || url,
      domain: new URL(fetched.finalUrl || url).hostname,
      crawled_at: isoNow(),
      content_hash: contentHash,
      excerpt: article.excerpt || '',
    };
    const mdWithFM = addFrontmatter(mdContent, meta);
    const chunks = chunkMarkdown(mdWithFM, {
      target_words,
      overlap_words: Math.min(250, Math.floor(target_words * 0.2)),
    });

    const resultJson = {
      id: sha256hex(meta.url + '|' + meta.content_hash),
      meta,
      md: mdWithFM,
      chunks,
      fetched: { status: fetched.status || 200 },
    };

    cacheSet(cacheKey, { json: resultJson, md: mdWithFM });

    if (raw) {
      console.log('Returning raw markdown');
      res.setHeader('content-type', 'text/markdown; charset=utf-8');
      return res.status(200).send(mdWithFM);
    } else {
      console.log('Returning JSON with', chunks.length);
      return res.status(200).json(resultJson);
    }
  } catch (err) {
    console.error('Error processing', url, err.stack || err);
    return res.status(500).json({ error: String(err.message || err) });
  }
});

// health
app.get('/health', (req, res) => res.json({ ok: true, ts: isoNow() }));

// start server and ensure browser kills on exit
(async () => {
  try {
    app.listen(PORT, () =>
      console.log(`Web To Markdown API listening on http://localhost:${PORT}`)
    );
    // ensure browser is launched lazily
    await getBrowser();
    process.on('SIGINT', async () => {
      console.log('Shutting down (SIGINT) ...');
      if (browserPromise) {
        try {
          (await browserPromise).close();
        } catch (_) {}
      }
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      console.log('Shutting down (SIGTERM) ...');
      if (browserPromise) {
        try {
          (await browserPromise).close();
        } catch (_) {}
      }
      process.exit(0);
    });
  } catch (e) {
    console.error('Failed to start', e);
    process.exit(1);
  }
})();
