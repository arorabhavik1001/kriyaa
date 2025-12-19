import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Link, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

const External = () => {
  const [url, setUrl] = useState("https://example.com");
  const [inputUrl, setInputUrl] = useState("https://example.com");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadUrl = () => {
    if (!inputUrl.trim()) return;
    let finalUrl = inputUrl;
    if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
      finalUrl = "https://" + finalUrl;
    }
    setIsLoading(true);
    setUrl(finalUrl);
    setTimeout(() => setIsLoading(false), 1000);
  };

  const refresh = () => {
    setIsLoading(true);
    setUrl("");
    setTimeout(() => {
      setUrl(inputUrl);
      setIsLoading(false);
    }, 100);
  };

  return (
    <DashboardLayout>
      <div className={`animate-fade-in ${isFullscreen ? "fixed inset-0 z-50 bg-background p-4" : ""}`}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">External Dashboard</h1>
            <p className="mt-1 text-muted-foreground">Embed and view external management tools</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <><Minimize2 className="mr-2 h-4 w-4" />Exit Fullscreen</>
            ) : (
              <><Maximize2 className="mr-2 h-4 w-4" />Fullscreen</>
            )}
          </Button>
        </div>

        {/* URL Bar */}
        <div className="mb-4 flex gap-3">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Enter dashboard URL..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadUrl()}
              className="pl-10 bg-card border-border"
            />
          </div>
          <Button onClick={loadUrl}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Load
          </Button>
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Iframe Container */}
        <div className={`rounded-xl border border-border bg-card overflow-hidden ${isFullscreen ? "h-[calc(100vh-12rem)]" : "h-[calc(100vh-16rem)]"}`}>
          {url ? (
            <iframe
              src={url}
              className="h-full w-full"
              title="External Dashboard"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <ExternalLink className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium text-foreground">No Dashboard Loaded</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter a URL above to embed your external management dashboard
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <p className="mt-3 text-xs text-muted-foreground">
          Note: Some websites may not allow embedding due to security restrictions (X-Frame-Options).
        </p>
      </div>
    </DashboardLayout>
  );
};

export default External;
