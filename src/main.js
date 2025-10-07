import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy,
  Download,
  Loader2,
  Globe,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function WebsiteScraper() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrapedData, setScrapedData] = useState(null);
  const [alert, setAlert] = useState({
    show: false,
    message: '',
    type: 'success',
  });
  const [toast, setToast] = useState({ show: false, message: '' });

  const showAlert = (message, type = 'success') => {
    setAlert({ show: true, message, type });
    setTimeout(
      () => setAlert({ show: false, message: '', type: 'success' }),
      5000
    );
  };

  const showToast = (message) => {
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
        `http://localhost:5600/?url=${encodeURIComponent(url)}`
      );

      if (!response.ok) {
        throw new Error(
          `Failed to scrape website (Status: ${response.status})`
        );
      }

      const data = await response.json();
      setScrapedData(data);
      showAlert('✅ Website scraped successfully!', 'success');
    } catch (error) {
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
    } catch (err) {
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      scrapeWebsite();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Globe className="w-10 h-10 text-purple-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Website Scraper
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Convert any website to structured JSON and Markdown format
          </p>
        </div>

        {/* Input Section */}
        <Card className="shadow-lg">
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
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button
                onClick={scrapeWebsite}
                disabled={loading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
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
                <AlertDescription>{alert.message}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {scrapedData && (
          <Card className="shadow-lg">
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
              <Tabs defaultValue="json" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="json">JSON View</TabsTrigger>
                  <TabsTrigger value="markdown">Markdown Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="json" className="mt-4">
                  <div className="bg-slate-950 text-slate-50 p-6 rounded-lg overflow-auto max-h-[600px]">
                    <pre className="text-sm">
                      {JSON.stringify(scrapedData, null, 2)}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="markdown" className="mt-4 space-y-4">
                  <Card className="bg-gradient-to-br from-purple-50 to-pink-50">
                    <CardHeader>
                      <CardTitle className="text-2xl text-purple-900">
                        {scrapedData?.meta?.title || 'No Title'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold text-gray-700">
                            URL:
                          </span>
                          <p className="text-gray-600 break-all">
                            {scrapedData?.meta?.url || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">
                            Domain:
                          </span>
                          <p className="text-gray-600">
                            {scrapedData?.meta?.domain || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">
                            Crawled at:
                          </span>
                          <p className="text-gray-600">
                            {scrapedData?.meta?.crawled_at || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">
                            Content Hash:
                          </span>
                          <p className="text-gray-600 font-mono text-xs">
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
                            scrapedData?.markdown ||
                            'No content available'}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-3 rounded-lg shadow-xl animate-in slide-in-from-right">
          {toast.message}
        </div>
      )}
    </div>
  );
}
