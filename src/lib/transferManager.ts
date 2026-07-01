export type TransferType = 'UPLOAD' | 'DOWNLOAD';

export interface TransferInfo {
  id: string;
  filename: string;
  type: TransferType;
  progress: number; // 0-100
  speed: number; // MB/s
  etaSeconds?: number;
  bytesTransferred: number;
  totalBytes: number;
  startTime: number;
  lastUpdate: number;
  lastSpeedUpdate: number;
  lastBytesCalc: number;
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
      etaSeconds: undefined,
      bytesTransferred: 0,
      totalBytes,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      lastSpeedUpdate: Date.now(),
      lastBytesCalc: 0,
    };
    this.transfers.set(id, info);
    this.notify();
  }

  updateTransfer(id: string, bytesTransferred: number) {
    const info = this.transfers.get(id);
    if (!info) return;

    const now = Date.now();
    info.bytesTransferred = Math.max(info.bytesTransferred, bytesTransferred);
    
    if (info.totalBytes > 0) {
      info.progress = Math.min(100, Math.round((info.bytesTransferred / info.totalBytes) * 100));
    } else {
      info.progress = 100;
    }

    const timeSinceSpeedCalc = (now - info.lastSpeedUpdate) / 1000;
    const totalTime = (now - info.startTime) / 1000;

    // Only recalculate speed every ~0.5s or on finish to prevent microsecond spikes
    if (timeSinceSpeedCalc >= 0.5 || info.progress === 100 || info.bytesTransferred >= info.totalBytes) {
      const bytesDiff = info.bytesTransferred - info.lastBytesCalc;
      let instantSpeed = 0;
      if (timeSinceSpeedCalc > 0) {
        instantSpeed = (bytesDiff / timeSinceSpeedCalc) / (1024 * 1024);
      }
      
      const avgSpeed = totalTime > 0 ? (info.bytesTransferred / totalTime) / (1024 * 1024) : instantSpeed;
      let calculatedSpeed = instantSpeed;

      if (totalTime < 2 || instantSpeed <= 0) {
        calculatedSpeed = avgSpeed;
      } else {
        calculatedSpeed = 0.4 * instantSpeed + 0.6 * (info.speed > 0 ? info.speed : avgSpeed);
      }

      info.speed = parseFloat(Math.max(0, calculatedSpeed).toFixed(1));
      info.lastSpeedUpdate = now;
      info.lastBytesCalc = info.bytesTransferred;

      if (info.speed > 0 && info.totalBytes > info.bytesTransferred) {
        const remainingBytes = info.totalBytes - info.bytesTransferred;
        info.etaSeconds = Math.round(remainingBytes / (info.speed * 1024 * 1024));
      } else {
        info.etaSeconds = 0;
      }
    }

    info.lastUpdate = now;
    this.notify();
  }

  completeTransfer(id: string) {
    const info = this.transfers.get(id);
    if (info) {
      info.progress = 100;
      info.etaSeconds = 0;
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
    Array.from(this.listeners).forEach((listener) => listener(data));
  }
}

const globalForTransfers = globalThis as unknown as { transferManager: TransferManager | undefined };
export const transferManager = globalForTransfers.transferManager ?? new TransferManager();
globalForTransfers.transferManager = transferManager;

