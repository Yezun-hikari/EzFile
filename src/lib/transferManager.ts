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
  private notifyTimeout: NodeJS.Timeout | null = null;
  private lastNotifyTime = 0;

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
    this.notifyImmediate();
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

    // Recalculate speed every ~0.5s or on finish
    if (timeSinceSpeedCalc >= 0.5 || info.progress === 100 || info.bytesTransferred >= info.totalBytes) {
      const bytesDiff = info.bytesTransferred - info.lastBytesCalc;
      let instantSpeed = 0;
      if (timeSinceSpeedCalc > 0) {
        instantSpeed = (bytesDiff / timeSinceSpeedCalc) / (1024 * 1024);
      }
      
      const avgSpeed = totalTime > 0 ? (info.bytesTransferred / totalTime) / (1024 * 1024) : instantSpeed;
      let calculatedSpeed = info.speed;

      if (totalTime < 2 || info.speed === 0) {
        calculatedSpeed = avgSpeed > 0 ? avgSpeed : instantSpeed;
      } else if (instantSpeed > 0) {
        // Smooth exponential moving average (EMA)
        calculatedSpeed = 0.25 * instantSpeed + 0.75 * info.speed;
      } else {
        // If instant speed dipped momentarily, decay gently towards average rather than dropping to zero
        calculatedSpeed = Math.max(info.speed * 0.85, avgSpeed * 0.5, 0.05);
      }

      info.speed = parseFloat(Math.max(0.01, calculatedSpeed).toFixed(1));
      info.lastSpeedUpdate = now;
      info.lastBytesCalc = info.bytesTransferred;

      if (info.speed > 0 && info.totalBytes > info.bytesTransferred) {
        const remainingBytes = info.totalBytes - info.bytesTransferred;
        info.etaSeconds = Math.round(remainingBytes / (info.speed * 1024 * 1024));
      } else if (info.bytesTransferred >= info.totalBytes) {
        info.etaSeconds = 0;
      }
    }

    info.lastUpdate = now;
    this.scheduleNotify();
  }

  completeTransfer(id: string) {
    const info = this.transfers.get(id);
    if (info) {
      info.progress = 100;
      info.etaSeconds = 0;
      this.notifyImmediate();
      
      setTimeout(() => {
        this.transfers.delete(id);
        this.notifyImmediate();
      }, 5000);
    }
  }
  
  failTransfer(id: string) {
    this.transfers.delete(id);
    this.notifyImmediate();
  }

  getTransfers() {
    const now = Date.now();
    Array.from(this.transfers.entries()).forEach(([id, info]) => {
      if (now - info.lastUpdate > 10 * 60 * 1000 && info.progress < 100) {
        this.transfers.delete(id);
      }
    });
    return Array.from(this.transfers.values());
  }

  subscribe(callback: (transfers: TransferInfo[]) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private scheduleNotify() {
    const now = Date.now();
    if (now - this.lastNotifyTime >= 400) {
      if (this.notifyTimeout) {
        clearTimeout(this.notifyTimeout);
        this.notifyTimeout = null;
      }
      this.notifyImmediate();
    } else if (!this.notifyTimeout) {
      this.notifyTimeout = setTimeout(() => {
        this.notifyTimeout = null;
        this.notifyImmediate();
      }, 400 - (now - this.lastNotifyTime));
    }
  }

  private notifyImmediate() {
    this.lastNotifyTime = Date.now();
    const data = this.getTransfers();
    Array.from(this.listeners).forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        this.listeners.delete(listener);
      }
    });
  }
}

const globalForTransfers = globalThis as unknown as { transferManager: TransferManager | undefined };
export const transferManager = globalForTransfers.transferManager ?? new TransferManager();
globalForTransfers.transferManager = transferManager;

