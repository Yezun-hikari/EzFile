type TransferType = 'UPLOAD' | 'DOWNLOAD';

export interface TransferInfo {
  id: string;
  filename: string;
  type: TransferType;
  progress: number; // 0-100
  speed: number; // MB/s
  bytesTransferred: number;
  totalBytes: number;
  startTime: number;
  lastUpdate: number;
}

class TransferManager {
  private transfers = new Map<string, TransferInfo>();
  private listeners = new Set<(transfers: TransferInfo[]) => void>();

  startTransfer(id: string, filename: string, type: TransferType, totalBytes: number) {
    const info: TransferInfo = {
      id,
      filename,
      type,
      progress: 0,
      speed: 0,
      bytesTransferred: 0,
      totalBytes,
      startTime: Date.now(),
      lastUpdate: Date.now(),
    };
    this.transfers.set(id, info);
    this.notify();
  }

  updateTransfer(id: string, bytesTransferred: number) {
    const info = this.transfers.get(id);
    if (!info) return;

    const now = Date.now();
    const timeDiff = (now - info.lastUpdate) / 1000; // in seconds
    const bytesDiff = bytesTransferred - info.bytesTransferred;
    
    let speed = 0;
    if (timeDiff > 0) {
      speed = (bytesDiff / timeDiff) / (1024 * 1024);
    }
    
    // fallback to average speed if instant is 0 or weird
    if (speed === 0 || timeDiff === 0) {
      const totalTime = (now - info.startTime) / 1000;
      if (totalTime > 0) {
        speed = (bytesTransferred / totalTime) / (1024 * 1024);
      }
    }

    info.bytesTransferred = bytesTransferred;
    // Calculate progress with a safeguard against division by zero
    if (info.totalBytes > 0) {
      info.progress = Math.min(100, Math.round((bytesTransferred / info.totalBytes) * 100));
    } else {
      info.progress = 100;
    }
    
    info.speed = parseFloat(speed.toFixed(1));
    info.lastUpdate = now;

    this.notify();
  }

  completeTransfer(id: string) {
    const info = this.transfers.get(id);
    if (info) {
      info.progress = 100;
      this.notify();
      
      // Keep it around for a few seconds so the UI shows it finished
      setTimeout(() => {
        this.transfers.delete(id);
        this.notify();
      }, 5000);
    }
  }
  
  failTransfer(id: string) {
      this.transfers.delete(id);
      this.notify();
  }

  getTransfers() {
    return Array.from(this.transfers.values());
  }

  subscribe(callback: (transfers: TransferInfo[]) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    const data = this.getTransfers();
    for (const listener of this.listeners) {
      listener(data);
    }
  }
}

// Global instance to prevent re-instantiation in development
const globalForTransfers = globalThis as unknown as { transferManager: TransferManager | undefined };
export const transferManager = globalForTransfers.transferManager ?? new TransferManager();
if (process.env.NODE_ENV !== "production") globalForTransfers.transferManager = transferManager;
