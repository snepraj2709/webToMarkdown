import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import {
  Copy,
  Download,
  Loader2,
  Globe,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function WebToMarkdown() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState<any>(null);
  const [alert, setAlert] = useState({
    show: false,
    message: '',
    type: 'success',
  });
  const [toast, setToast] = useState({ show: false, message: '' });

  const showAlert = (message: string, type = 'success') => {
    setAlert({ show: true, message, type });
    setTimeout(
      () => setAlert({ show: false, message: '', type: 'success' }),
      5000
    );
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const scrapeWebsite = async () => {
    if (!url.trim()) {
      showAlert('Please enter a valid URL', 'error');
      return;
    }

    setLoading(true);
    setAlert({ show: false, message: '', type: 'success' });

    try {
      const response = await fetch(
        `https://webtomarkdown.onrender.com/?url=${encodeURIComponent(url)}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to scrape website (Status: ${response.status})`
        );
      }

      const data = await response.json();
      setScrapedData(data);
      showAlert('✅ Website scraped successfully!', 'success');
    } catch (error: any) {
      showAlert(`❌ Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      const jsonText = JSON.stringify(scrapedData, null, 2);
      await navigator.clipboard.writeText(jsonText);
      showToast('✅ Content copied to clipboard!');
    } catch {
      showToast('❌ Failed to copy content');
    }
  };

  const downloadJSON = () => {
    const jsonStr = JSON.stringify(scrapedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const filename = `scraped_${url
      .replace(/https?:\/\//, '')
      .replace(/\//g, '_')}.json`;

    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);

    showToast('✅ JSON file downloaded!');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      scrapeWebsite();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 via-slate-50 to-neutral-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Globe className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-pink-500 bg-clip-text text-transparent">
              Website Scraper
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Convert any website to structured JSON and Markdown format
          </p>
        </div>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Enter Website URL</CardTitle>
            <CardDescription>
              Paste the URL you want to scrape and convert to markdown
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyPress}
                className="flex-1"
              />
              <Button
                onClick={scrapeWebsite}
                disabled={loading}
                className="bg-gradient-to-r from-primary to-pink-600 hover:opacity-90">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Globe className="mr-2 h-4 w-4" />
                    Scrape Website
                  </>
                )}
              </Button>
            </div>

            {alert.show && (
              <Alert
                variant={alert.type === 'error' ? 'destructive' : 'default'}>
                {alert.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {alert.type === 'error' ? 'Error' : 'Success'}
                </AlertTitle>
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {scrapedData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scraped Content</CardTitle>
                  <CardDescription>
                    View and download your scraped data
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadJSON}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="markdown" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="markdown">Markdown Preview</TabsTrigger>
                  <TabsTrigger value="json">JSON View</TabsTrigger>
                </TabsList>

                <TabsContent value="markdown" className="mt-4 space-y-4">
                  <Card className="bg-neutral-50">
                    <CardHeader>
                      <CardTitle className="text-2xl text-primary">
                        {scrapedData?.meta?.title || 'No Title'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold">URL:</span>
                          <p className="text-muted-foreground break-all">
                            {scrapedData?.meta?.url || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold">Domain:</span>
                          <p className="text-muted-foreground">
                            {scrapedData?.meta?.domain || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold">Crawled at:</span>
                          <p className="text-muted-foreground">
                            {scrapedData?.meta?.crawled_at || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold">Content Hash:</span>
                          <p className="font-mono text-xs text-muted-foreground">
                            {scrapedData?.meta?.content_hash
                              ? scrapedData.meta.content_hash.substring(0, 16) +
                                '...'
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-slate-50 p-4 rounded-lg overflow-auto max-h-[400px]">
                        <pre className="text-sm whitespace-pre-wrap">
                          {scrapedData?.content ||
                            scrapedData?.md ||
                            'No content available'}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="json" className="mt-4">
                  <div className="bg-slate-950 text-slate-50 p-6 rounded-lg overflow-auto max-h-[600px]">
                    <pre className="text-sm">
                      {JSON.stringify(scrapedData, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-right">
          {toast.message}
        </div>
      )}
    </div>
  );
}
