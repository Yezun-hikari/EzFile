"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import PasswordPrompt from "@/components/PasswordPrompt";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Download, UploadCloud, FileIcon, X, CheckSquare, Square, Trash2, Archive, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { processDroppedOrSelectedFiles } from "@/lib/zipFolder";

export default function PublicLinkPage({ params }: { params: { urlPath: string } }) {
  type LinkData = {
    id: string;
    type: string;
    maxSizeLimit: string | null;
    files: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      size: string;
      isComplete?: boolean;
    }>;
  };

  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [requirePassword, setRequirePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [zipProgress, setZipProgress] = useState("");

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const processed = await processDroppedOrSelectedFiles(
      e.dataTransfer.items,
      e.dataTransfer.files,
      (msg) => setZipProgress(msg)
    );
    if (processed.length > 0) {
      setUploadFiles((prev) => [...prev, ...processed]);
    }
  };

  // Bulk actions state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  
  // Modals state
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);

  const fetchLink = async (pwd?: string) => {
    setLoading(true);
    setError("");
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const opts = pwd ? { method: "POST", body: JSON.stringify({ password: pwd }) } : { method: "GET" };
      const res = await fetch(`${basePath}/api/public/links/${params.urlPath}`, opts);
      const data = await res.json();

      if (res.ok) {
        if (data.requirePassword) {
          setRequirePassword(true);
        } else {
          setLinkData(data.link);
          setRequirePassword(false);
          // Clear selections when data reloads
          setSelectedFiles(new Set());
        }
      } else {
        setError(data.error || "Failed to load link");
      }
    } catch (err) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLink();
  }, [params.urlPath]);

  useEffect(() => {
    if (!linkData || linkData.type !== "FILE_TUNNEL") return;
    const interval = setInterval(async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const opts = password ? { method: "POST", body: JSON.stringify({ password }) } : { method: "GET" };
        const res = await fetch(`${basePath}/api/public/links/${params.urlPath}`, opts);
        if (res.ok) {
          const data = await res.json();
          if (data.link) setLinkData(data.link);
        }
      } catch (e) {
        // ignore errors on silent poll
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [linkData?.type, password, params.urlPath]);

  const handlePasswordSubmit = (pwd: string) => {
    setPassword(pwd);
    fetchLink(pwd);
  };

  const handleDeleteFile = async () => {
    if (!fileToDelete) return;
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/files/${fileToDelete}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        toast({ title: "Success", description: "File deleted successfully", type: "success" });
        fetchLink(password);
      } else {
        toast({ title: "Error", description: "Failed to delete file", type: "error" });
      }
    } catch (err) {
      toast({ title: "Error", description: "An error occurred", type: "error" });
    } finally {
      setFileToDelete(null);
    }
  };

  const handleDeleteBatch = async () => {
    if (selectedFiles.size === 0) return;
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/files/batch`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selectedFiles), password }),
      });
      if (res.ok) {
        toast({ title: "Success", description: "Files deleted successfully", type: "success" });
        fetchLink(password);
      } else {
        toast({ title: "Error", description: "Failed to delete files", type: "error" });
      }
    } catch (err) {
      toast({ title: "Error", description: "An error occurred", type: "error" });
    } finally {
      setShowBatchDeleteModal(false);
    }
  };

  const handleDownloadZip = () => {
    if (selectedFiles.size === 0) return;
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      toast({ title: "Starting Download", description: "Your zip download is starting...", type: "success" });
      
      const idsParam = encodeURIComponent(Array.from(selectedFiles).join(","));
      const pwdParam = password ? `&password=${encodeURIComponent(password)}` : "";
      const downloadUrl = `${basePath}/api/download/zip?fileIds=${idsParam}${pwdParam}`;
      
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "ezfile_download.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast({ title: "Error", description: "Failed to download zip", type: "error" });
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
        await new Promise(r => setTimeout(r, Math.min(Math.pow(2, attempt) * 1000, 10000)));
      }
    }
  };

  const handleDropZoneUpload = async () => {
    if (uploadFiles.length === 0 || !linkData || isUploading) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadSpeed("");

    let totalUploaded = 0;
    const totalSize = uploadFiles.reduce((acc, f) => acc + f.size, 0);
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

    let lastTime = Date.now();
    const uploadStartTime = Date.now();

    try {
      for (const file of uploadFiles) {
        const CHUNK_SIZE = file.size > 100 * 1024 * 1024 ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const chunkLoaded = new Array(totalChunks).fill(0);

        let smoothedBps = 0;
        const updateOverallProgress = () => {
          const fileUploaded = chunkLoaded.reduce((a, b) => a + b, 0);
          const currentUploaded = totalUploaded + fileUploaded;
          setUploadProgress(Math.round((currentUploaded / totalSize) * 100));

          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000;
          if (timeDiff >= 0.4 || currentUploaded === totalSize) {
            const totalTimeSec = Math.max((now - uploadStartTime) / 1000, 0.1);
            const instantAvgBps = currentUploaded / totalTimeSec;
            smoothedBps = smoothedBps === 0 ? instantAvgBps : 0.3 * instantAvgBps + 0.7 * smoothedBps;
            const displayMbps = (smoothedBps / (1024 * 1024)).toFixed(1);

            let etaStr = "";
            if (smoothedBps > 0 && currentUploaded < totalSize && totalTimeSec >= 1.5) {
              const remSec = (totalSize - currentUploaded) / smoothedBps;
              etaStr = ` - ETA ~${formatEta(remSec)}`;
            }

            setUploadSpeed(`${displayMbps} MB/s${etaStr}`);
            lastTime = now;
          }
        };

        // Chunk 0: upload sequentially first to initialize storage & clean old files
        if (totalChunks > 0) {
          const start = 0;
          const end = Math.min(CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const url = `${basePath}/api/upload?linkId=${linkData.id}&filename=${encodeURIComponent(file.name)}&chunkIndex=0&totalChunks=${totalChunks}&totalSize=${file.size}&startOffset=0`;
          
          await uploadChunkWithRetry(url, chunk, (loaded) => {
            chunkLoaded[0] = loaded;
            updateOverallProgress();
          });
          chunkLoaded[0] = chunk.size;
          updateOverallProgress();
        }

        // Chunks 1..N: upload concurrently with CONCURRENCY = 4
        if (totalChunks > 1) {
          const queue: number[] = [];
          for (let i = 1; i < totalChunks; i++) queue.push(i);

          const CONCURRENCY = 4;
          const workers = new Array(Math.min(CONCURRENCY, queue.length)).fill(0).map(async () => {
            while (queue.length > 0) {
              const i = queue.shift()!;
              const start = i * CHUNK_SIZE;
              const end = Math.min(start + CHUNK_SIZE, file.size);
              const chunk = file.slice(start, end);
              const url = `${basePath}/api/upload?linkId=${linkData.id}&filename=${encodeURIComponent(file.name)}&chunkIndex=${i}&totalChunks=${totalChunks}&totalSize=${file.size}&startOffset=${start}`;

              await uploadChunkWithRetry(url, chunk, (loaded) => {
                chunkLoaded[i] = loaded;
                updateOverallProgress();
              });
              chunkLoaded[i] = chunk.size;
              updateOverallProgress();
            }
          });

          await Promise.all(workers);
        }

        totalUploaded += file.size;
      }
      toast({ title: "Success", description: "Files uploaded successfully!", type: "success" });
      setUploadFiles([]);
      setUploadProgress(0);
      setUploadSpeed("");
      fetchLink(password);
    } catch (err) {
      toast({ title: "Error", description: "Upload failed.", type: "error" });
      setUploadProgress(0);
      setUploadSpeed("");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSelectAll = () => {
    if (!linkData) return;
    if (selectedFiles.size === linkData.files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(linkData.files.map(f => f.id)));
    }
  };

  const toggleFile = (id: string) => {
    const newSet = new Set(selectedFiles);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedFiles(newSet);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-destructive mb-4">Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (requirePassword) {
    return <PasswordPrompt onAuthSuccess={handlePasswordSubmit} />;
  }

  if (!linkData) return null;

  const isShare = linkData.type === "SHARE";

  const renderFilesList = () => (
    <div className="mt-8">
      {linkData.files.length > 0 && (
        <div className="flex items-center justify-between mb-4 bg-muted/50 p-3 rounded-lg border">
          <div className="flex items-center gap-2">
            <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
              <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                selectedFiles.size === linkData.files.length && linkData.files.length > 0
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input bg-background"
              }`}>
                {selectedFiles.size === linkData.files.length && linkData.files.length > 0 && (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
              </div>
              <span className="text-sm font-medium">Select All</span>
            </button>
            <span className="text-sm text-muted-foreground ml-4">
              {selectedFiles.size} selected
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadZip}
              disabled={selectedFiles.size === 0}
              className="gap-2"
            >
              <Archive className="w-4 h-4" />
              Download ZIP
            </Button>
            {!isShare && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowBatchDeleteModal(true)}
                disabled={selectedFiles.size === 0}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {linkData.files.map((file) => {
          const isImage = file.originalName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
          const isVideo = file.originalName.match(/\.(mp4|webm|ogg)$/i);
          const isSelected = selectedFiles.has(file.id);

          return (
            <div key={file.id} className={`border rounded-lg bg-card overflow-hidden flex flex-col relative group transition-all duration-200 ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}>
              
              {/* Checkbox Overlay */}
              <button 
                onClick={() => toggleFile(file.id)}
                className={`absolute top-3 left-3 z-20 w-6 h-6 rounded flex items-center justify-center shadow transition-all ${
                  isSelected 
                    ? "bg-primary border border-primary text-primary-foreground" 
                    : "bg-background/80 backdrop-blur-sm border border-foreground/30 opacity-70 group-hover:opacity-100 hover:border-primary"
                }`}
                title={isSelected ? "Deselect" : "Select"}
              >
                {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
              </button>

              {!isShare && (
                <button 
                  onClick={() => setFileToDelete(file.id)}
                  className="absolute top-3 right-3 p-1.5 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
                  title="Delete file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              
              <div 
                className="h-40 bg-muted flex items-center justify-center relative cursor-pointer"
                onClick={() => toggleFile(file.id)}
              >
                {/* Dark overlay when selected */}
                {isSelected && <div className="absolute inset-0 bg-primary/10 z-10 pointer-events-none" />}
                
                {isImage ? (
                  <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} alt={file.originalName} className="w-full h-full object-cover" />
                ) : isVideo ? (
                  <video src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} className="w-full h-full object-cover" />
                ) : (
                  <FileIcon className="w-16 h-16 text-muted-foreground" />
                )}
              </div>
              
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate" title={file.originalName}>{file.originalName}</p>
                    {file.isComplete === false && (
                      <span className="shrink-0 text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                        🟢 Live Tunnel
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{(Number(file.size) / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button asChild variant="secondary" size="sm" className="w-full gap-2">
                  <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} download>
                    <Download className="w-4 h-4" />
                    Download File
                  </a>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-primary mb-2">EzFile</h1>
        <p className="text-muted-foreground mb-8">
          {isShare 
            ? "Files shared with you" 
            : linkData.type === "FILE_TUNNEL"
              ? "⚡ File Tunnel: Simultanes Hochladen & Live-Stream Download"
              : "Drop-Zone: Send files to the owner"}
        </p>

        {isShare ? (
          renderFilesList()
        ) : (
          <>
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border rounded-lg bg-card p-8 text-center max-w-xl mx-auto shadow-sm hover:bg-primary/5 transition-colors border-dashed border-2 border-primary/40"
          >
            <UploadCloud className="w-16 h-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">Upload Files or Folders</h3>
            <p className="text-sm text-muted-foreground mb-6">Drag & Drop oder Schaltflächen nutzen. Ordner werden automatisch komprimiert (.zip)</p>
            
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <label className="cursor-pointer">
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2">
                  Dateien auswählen
                </span>
                <input 
                  type="file" 
                  multiple 
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files) {
                      const processed = await processDroppedOrSelectedFiles(null, e.target.files, setZipProgress);
                      setUploadFiles((prev) => [...prev, ...processed]);
                    }
                  }}
                />
              </label>
              <label className="cursor-pointer">
                <span className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 px-4 py-2">
                  Ordner auswählen (.zip)
                </span>
                <input 
                  type="file" 
                  multiple 
                  {...({ webkitdirectory: "" } as any)}
                  className="hidden"
                  onChange={async (e) => {
                    if (e.target.files) {
                      const processed = await processDroppedOrSelectedFiles(null, e.target.files, setZipProgress);
                      setUploadFiles((prev) => [...prev, ...processed]);
                    }
                  }}
                />
              </label>
            </div>

            {zipProgress && (
              <div className="mb-6 p-3 bg-primary/10 border border-primary/20 rounded-md text-sm text-primary font-medium animate-pulse">
                ⚡ {zipProgress}
              </div>
            )}

            {uploadFiles.length > 0 && (
              <div className="mb-6 text-left border rounded p-4 bg-muted/30">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium text-sm">Selected ({uploadFiles.length}):</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setUploadFiles([])}>Clear All</Button>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground max-h-32 overflow-y-auto">
                  {uploadFiles.map((f, i) => (
                    <li key={i} className="flex justify-between items-center">
                      <span className="truncate">{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</span>
                      <button 
                        type="button" 
                        onClick={() => setUploadFiles(uploadFiles.filter((_, idx) => idx !== i))}
                        className="text-destructive hover:underline text-xs ml-2 shrink-0"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {isUploading && (
              <div className="mb-6">
                <div className="flex justify-between text-sm text-primary mb-2">
                  <span className="font-medium">Uploading... {uploadSpeed && `(${uploadSpeed})`}</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-200 ease-out" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleDropZoneUpload} 
              disabled={uploadFiles.length === 0 || isUploading}
              className="w-full h-12 text-md"
            >
              {isUploading ? "Uploading..." : "Upload Files"}
            </Button>
          </div>
          
          {linkData.files.length > 0 && (
            <div className="mt-16">
              <h3 className="text-2xl font-semibold mb-2">
                {linkData.type === "FILE_TUNNEL" ? "⚡ Live Tunnel Files" : "Uploaded Files"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {linkData.type === "FILE_TUNNEL" 
                  ? "Dateien stehen hier sofort während des Hochladens für andere zum Live-Download zur Verfügung."
                  : "Manage files previously uploaded to this Drop-Zone."}
              </p>
              {renderFilesList()}
            </div>
          )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={!!fileToDelete}
        title="Delete File"
        description="Are you sure you want to delete this file? This action cannot be undone."
        confirmText="Delete"
        isDestructive={true}
        onConfirm={handleDeleteFile}
        onCancel={() => setFileToDelete(null)}
      />

      <ConfirmModal
        isOpen={showBatchDeleteModal}
        title={`Delete ${selectedFiles.size} Files`}
        description="Are you sure you want to delete all selected files? This action cannot be undone."
        confirmText="Delete All"
        isDestructive={true}
        onConfirm={handleDeleteBatch}
        onCancel={() => setShowBatchDeleteModal(false)}
      />
    </div>
  );
}
