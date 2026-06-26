"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreateLinkPage() {
  const router = useRouter();
  const [type, setType] = useState("SHARE");
  const [urlPath, setUrlPath] = useState("");
  const [password, setPassword] = useState("");
  const [maxUsage, setMaxUsage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState("");

  const handleGeneratePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let p = "";
    for (let i = 0; i < 12; i++) {
      p += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(p);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const formatEta = (seconds: number) => {
    if (!isFinite(seconds) || seconds <= 0) return "";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const uploadChunkWithRetry = async (url: string, chunk: Blob, onProgress: (loaded: number) => void, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(e.loaded);
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
            else reject(new Error(`HTTP ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error("Network Error"));
          xhr.open("POST", url);
          xhr.send(chunk);
        });
      } catch (err) {
        if (attempt === maxRetries) throw err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setProgress(0);
    setUploadSpeed("");

    try {
      if (type === "DROP_ZONE" && !password) {
        alert("A password is required for Drop-Zones.");
        setUploading(false);
        return;
      }

      // 1. Create Link
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const linkRes = await fetch(`${basePath}/api/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urlPath,
          type,
          password,
          maxUsage: maxUsage ? parseInt(maxUsage) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      if (!linkRes.ok) throw new Error("Failed to create link");
      const { link } = await linkRes.json();

      // 2. Upload Files
      if (type === "SHARE" && files.length > 0) {
        let totalUploaded = 0;
        const totalSize = files.reduce((acc, f) => acc + f.size, 0);
        let lastLoaded = 0;
        let lastTime = Date.now();
        const uploadStartTime = Date.now();

        for (const file of files) {
          const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks for optimal throughput
          const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
          
          for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            
            const url = `${basePath}/api/upload?linkId=${link.id}&filename=${encodeURIComponent(file.name)}&chunkIndex=${i}&totalChunks=${totalChunks}&totalSize=${file.size}`;

            await uploadChunkWithRetry(url, chunk, (loaded) => {
              const now = Date.now();
              const currentUploaded = totalUploaded + loaded;
              setProgress(Math.round((currentUploaded / totalSize) * 100));
              
              const timeDiff = (now - lastTime) / 1000;
              if (timeDiff >= 0.25) {
                const bytesDiff = loaded - lastLoaded;
                const speedMbps = (bytesDiff / timeDiff) / (1024 * 1024);
                
                const totalTimeSec = (now - uploadStartTime) / 1000;
                const avgBps = totalTimeSec > 0 ? currentUploaded / totalTimeSec : 0;
                const remSec = avgBps > 0 ? (totalSize - currentUploaded) / avgBps : 0;
                const etaStr = remSec > 0 && currentUploaded < totalSize ? ` - ETA ~${formatEta(remSec)}` : "";
                
                setUploadSpeed(`${speedMbps.toFixed(1)} MB/s${etaStr}`);
                lastLoaded = loaded;
                lastTime = now;
              }
            });
            
            totalUploaded += chunk.size;
            setProgress(Math.round((totalUploaded / totalSize) * 100));
            lastLoaded = 0;
            lastTime = Date.now();
          }
        }
      }

      router.push("/admin");
    } catch (err) {
      console.error(err);
      alert("Error creating link");
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadSpeed("");
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Create New Link</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex gap-4 mb-6">
          <Button 
            type="button" 
            variant={type === "SHARE" ? "default" : "outline"}
            onClick={() => setType("SHARE")}
          >
            Share Files
          </Button>
          <Button 
            type="button" 
            variant={type === "DROP_ZONE" ? "default" : "outline"}
            onClick={() => setType("DROP_ZONE")}
          >
            Drop-Zone (Receive)
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom URL Path (Optional)</label>
            <Input 
              value={urlPath}
              onChange={e => setUrlPath(e.target.value)}
              placeholder="my-cool-files"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Password (Optional)</label>
            <div className="flex gap-2">
              <Input 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Leave blank for no password"
              />
              <Button type="button" variant="secondary" onClick={handleGeneratePassword}>Generate</Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Max Usages</label>
            <Input 
              type="number"
              value={maxUsage}
              onChange={e => setMaxUsage(e.target.value)}
              placeholder="Unlimited"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Expiration Date</label>
            <Input 
              type="datetime-local"
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
            />
          </div>
        </div>

        {type === "SHARE" && (
          <div 
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border-2 border-dashed border-primary/50 rounded-lg p-12 text-center bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <p className="text-lg font-medium text-primary mb-2">Drag & Drop files here</p>
            <p className="text-sm text-muted-foreground mb-4">or click to select files</p>
            <Input 
              type="file" 
              multiple 
              className="max-w-xs mx-auto"
              onChange={e => {
                if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
              }}
            />
            {files.length > 0 && (
              <div className="mt-6 text-left border-t border-primary/20 pt-4">
                <h4 className="font-medium mb-2">Selected Files ({files.length}):</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {files.map((f, i) => (
                    <li key={i}>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {uploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-primary">
              <span>Uploading... {uploadSpeed && `(${uploadSpeed})`}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-4 mt-8 border-t pt-6">
          <Button type="button" variant="outline" onClick={() => router.push("/admin")}>
            Cancel
          </Button>
          <Button type="submit" disabled={uploading || (type === "SHARE" && files.length === 0)}>
            {uploading ? "Creating..." : "Create Link"}
          </Button>
        </div>
      </form>
    </div>
  );
}
