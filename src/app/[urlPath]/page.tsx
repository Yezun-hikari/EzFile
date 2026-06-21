"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import PasswordPrompt from "@/components/PasswordPrompt";
import { useToast } from "@/components/ui/ToastProvider";
import { Download, UploadCloud, FileIcon, ImageIcon, VideoIcon, X } from "lucide-react";
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

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/files/${fileId}`, {
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
    }
  };

  const handleDropZoneUpload = async () => {
    if (uploadFiles.length === 0 || !linkData) return;
    setUploadProgress(0);

    let totalUploaded = 0;
    const totalSize = uploadFiles.reduce((acc, f) => acc + f.size, 0);

    try {
      for (const file of uploadFiles) {
        const CHUNK_SIZE = 5 * 1024 * 1024;
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
          await fetch(`${basePath}/api/upload?linkId=${linkData.id}&filename=${encodeURIComponent(file.name)}&chunkIndex=${i}&totalChunks=${totalChunks}&totalSize=${file.size}`, {
            method: "POST",
            body: chunk,
          });

          totalUploaded += chunk.size;
          setUploadProgress(Math.round((totalUploaded / totalSize) * 100));
        }
      }
      toast({ title: "Success", description: "Files uploaded successfully!", type: "success" });
      setUploadFiles([]);
      fetchLink(password);
    } catch (err) {
      toast({ title: "Error", description: "Upload failed.", type: "error" });
    }
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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-primary mb-2">EzFile</h1>
        <p className="text-muted-foreground mb-8">
          {isShare ? "Files shared with you" : "Drop-Zone: Send files to the owner"}
        </p>

        {isShare ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {linkData.files.map((file) => {
              const isImage = file.originalName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isVideo = file.originalName.match(/\.(mp4|webm|ogg)$/i);

              return (
                <div key={file.id} className="border rounded-lg bg-card overflow-hidden flex flex-col">
                  <div className="h-48 bg-muted flex items-center justify-center">
                    {isImage ? (
                      <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} alt={file.originalName} className="w-full h-full object-cover" />
                    ) : isVideo ? (
                      <video src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} controls className="w-full h-full object-cover" />
                    ) : (
                      <FileIcon className="w-16 h-16 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="font-medium truncate" title={file.originalName}>{file.originalName}</p>
                      <p className="text-sm text-muted-foreground">{(Number(file.size) / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <Button asChild className="mt-4 w-full gap-2">
                      <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} download>
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
          <div className="border rounded-lg bg-card p-8 text-center max-w-xl mx-auto">
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
              <div className="mb-6 text-left border rounded p-4">
                <p className="font-medium mb-2">Selected ({uploadFiles.length}):</p>
                <ul className="text-sm space-y-1">
                  {uploadFiles.map((f, i) => <li key={i}>{f.name}</li>)}
                </ul>
              </div>
            )}
            
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mb-6">
                <div className="flex justify-between text-sm text-primary mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleDropZoneUpload} 
              disabled={uploadFiles.length === 0 || (uploadProgress > 0 && uploadProgress < 100)}
              className="w-full"
            >
              {uploadProgress > 0 && uploadProgress < 100 ? "Uploading..." : "Upload"}
            </Button>
          </div>
          
          {/* Drop-Zone Uploaded Files List */}
          {linkData.files.length > 0 && (
            <div className="mt-12">
              <h3 className="text-xl font-medium mb-4">Uploaded Files</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {linkData.files.map((file) => {
                  const isImage = file.originalName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                  const isVideo = file.originalName.match(/\.(mp4|webm|ogg)$/i);

                  return (
                    <div key={file.id} className="border rounded-lg bg-card overflow-hidden flex flex-col relative group">
                      <button 
                        onClick={() => handleDeleteFile(file.id)}
                        className="absolute top-2 right-2 p-1 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Delete file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="h-32 bg-muted flex items-center justify-center relative">
                        {isImage ? (
                          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} alt={file.originalName} className="w-full h-full object-cover" />
                        ) : isVideo ? (
                          <video src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} className="w-full h-full object-cover" />
                        ) : (
                          <FileIcon className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="font-medium text-sm truncate" title={file.originalName}>{file.originalName}</p>
                          <p className="text-xs text-muted-foreground">{(Number(file.size) / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="mt-3 w-full gap-2">
                          <a href={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/download/${file.id}`} download>
                            <Download className="w-3 h-3" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
