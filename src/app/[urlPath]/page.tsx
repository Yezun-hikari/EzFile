"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import PasswordPrompt from "@/components/PasswordPrompt";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Download, UploadCloud, FileIcon, X, CheckSquare, Square, Trash2, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";

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

  const handleDownloadZip = async () => {
    if (selectedFiles.size === 0) return;
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      toast({ title: "Zipping", description: "Generating zip file...", type: "success" });
      
      const res = await fetch(`${basePath}/api/download/zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selectedFiles), password }),
      });
      
      if (!res.ok) throw new Error();
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ezfile_download.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      toast({ title: "Error", description: "Failed to download zip", type: "error" });
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

    let lastLoaded = 0;
    let lastTime = Date.now();

    try {
      for (const file of uploadFiles) {
        const CHUNK_SIZE = 5 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const url = `${basePath}/api/upload?linkId=${linkData.id}&filename=${encodeURIComponent(file.name)}&chunkIndex=${i}&totalChunks=${totalChunks}&totalSize=${file.size}`;
          
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const now = Date.now();
                const currentUploaded = totalUploaded + e.loaded;
                setUploadProgress(Math.round((currentUploaded / totalSize) * 100));
                
                const timeDiff = (now - lastTime) / 1000;
                if (timeDiff >= 0.25) {
                  const bytesDiff = e.loaded - lastLoaded;
                  const speedMbps = (bytesDiff / timeDiff) / (1024 * 1024);
                  setUploadSpeed(`${speedMbps.toFixed(1)} MB/s`);
                  lastLoaded = e.loaded;
                  lastTime = now;
                }
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                totalUploaded += chunk.size;
                setUploadProgress(Math.round((totalUploaded / totalSize) * 100));
                lastLoaded = 0;
                lastTime = Date.now();
                resolve(xhr.response);
              } else {
                reject(xhr.statusText || `HTTP ${xhr.status}`);
              }
            };
            xhr.onerror = () => reject(xhr.statusText || "Network Error");
            xhr.open("POST", url);
            xhr.send(chunk);
          });
        }
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
              {selectedFiles.size === linkData.files.length && linkData.files.length > 0 ? (
                <CheckSquare className="w-5 h-5 text-primary" />
              ) : (
                <Square className="w-5 h-5" />
              )}
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
                className="absolute top-3 left-3 z-20 text-white drop-shadow-md hover:scale-110 transition-transform"
              >
                {isSelected ? (
                  <CheckSquare className="w-6 h-6 text-primary fill-background" />
                ) : (
                  <Square className="w-6 h-6 opacity-50 group-hover:opacity-100" />
                )}
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
                  <p className="font-medium text-sm truncate" title={file.originalName}>{file.originalName}</p>
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
          {isShare ? "Files shared with you" : "Drop-Zone: Send files to the owner"}
        </p>

        {isShare ? (
          renderFilesList()
        ) : (
          <>
          <div className="border rounded-lg bg-card p-8 text-center max-w-xl mx-auto shadow-sm">
            <UploadCloud className="w-16 h-16 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-4">Upload Files</h3>
            <Input 
              type="file" 
              multiple 
              onChange={(e) => {
                if (e.target.files) setUploadFiles(Array.from(e.target.files));
              }}
              className="max-w-xs mx-auto mb-6"
            />
            {uploadFiles.length > 0 && (
              <div className="mb-6 text-left border rounded p-4 bg-muted/30">
                <p className="font-medium mb-2 text-sm">Selected ({uploadFiles.length}):</p>
                <ul className="text-sm space-y-1 text-muted-foreground max-h-32 overflow-y-auto">
                  {uploadFiles.map((f, i) => <li key={i} className="truncate">{f.name}</li>)}
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
              <h3 className="text-2xl font-semibold mb-2">Uploaded Files</h3>
              <p className="text-muted-foreground mb-4">Manage files previously uploaded to this Drop-Zone.</p>
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
