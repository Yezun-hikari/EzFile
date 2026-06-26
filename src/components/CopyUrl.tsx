"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export function CopyUrl({ domain, urlBasePath, urlPath }: { domain?: string, urlBasePath?: string, urlPath: string }) {
  const [fullUrl, setFullUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let bp = urlBasePath !== undefined ? urlBasePath : (process.env.NEXT_PUBLIC_BASE_PATH || "");
    if (bp === "/__NEXT_BASE_PATH_PLACEHOLDER__") bp = "";
    
    // Fallback: detect basePath from pathname if we are inside /admin
    if (!bp && typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const adminIdx = pathname.indexOf("/admin");
      if (adminIdx > 0) bp = pathname.slice(0, adminIdx);
    }

    if (bp && !bp.startsWith("/")) bp = "/" + bp;
    if (bp && bp.endsWith("/")) bp = bp.slice(0, -1);
    
    let origin = window.location.origin;
    if (domain) {
      if (!domain.startsWith("http")) {
        origin = domain.includes("localhost") || domain.includes("127.0.0.1") ? `http://${domain}` : `https://${domain}`;
      } else {
        origin = domain;
      }
    }
    origin = origin.replace(/\/$/, "");
    
    setFullUrl(`${origin}${bp}/${urlPath}`);
  }, [urlPath, domain, urlBasePath]);

  const handleCopy = () => {
    if (!fullUrl) return;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast({ title: "Copied!", description: "URL copied to clipboard", type: "success" });
    setTimeout(() => setCopied(false), 2000);
  };

  if (!fullUrl) return <span className="text-muted-foreground">/{urlPath}</span>;

  return (
    <div className="flex items-center gap-2 max-w-[200px]">
      <a href={fullUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate" title={fullUrl}>
        {fullUrl}
      </a>
      <button 
        onClick={handleCopy} 
        className="text-muted-foreground hover:text-foreground shrink-0"
        title="Copy URL"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
