"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);

  useEffect(() => {
    const eventSource = new EventSource("/api/admin/sse");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTransfers(data.transfers || []);
      } catch (err) {
        console.error("Failed to parse SSE data", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          Active Transfers
        </h2>
        <p className="text-muted-foreground">Real-time view of ongoing uploads and downloads.</p>
      </div>

      <div className="grid gap-4">
        {transfers.length === 0 ? (
          <div className="p-8 border rounded-md text-center text-muted-foreground bg-card">
            No active transfers right now.
          </div>
        ) : (
          transfers.map((t, idx) => (
            <div key={idx} className="p-4 border rounded-md bg-card flex items-center justify-between">
              <div>
                <p className="font-medium">{t.filename}</p>
                <p className="text-sm text-muted-foreground">{t.type} • {t.speed} MB/s</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">{t.progress}%</p>
                <div className="w-32 h-2 bg-muted rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${t.progress}%` }}></div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
