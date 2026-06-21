"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

export function CopyUrl({ urlPath }: { urlPath: string }) {
  const [fullUrl, setFullUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    // Replace placeholder if it leaked through somehow (should be replaced by start.sh)
    const cleanBasePath = basePath === "/__NEXT_BASE_PATH_PLACEHOLDER__" ? "" : basePath;
    setFullUrl(`${window.location.origin}${cleanBasePath}/${urlPath}`);
  }, [urlPath]);

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
