import { NextResponse } from "next/server";
import { transferManager } from "@/lib/transferManager";
import type { TransferInfo } from "@/lib/transferManager";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = (transfers: TransferInfo[]) => {
        const data = { transfers };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial data
      sendUpdate(transferManager.getTransfers());

      // Subscribe to real-time updates
      const unsubscribe = transferManager.subscribe(sendUpdate);

      req.signal.addEventListener("abort", () => {
        unsubscribe();
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
