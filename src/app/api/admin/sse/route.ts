import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const sendUpdate = () => {
        // Dummy data for now. In a real app, this would pull from a global transfer manager or redis
        const data = {
          transfers: [
            {
              id: "1",
              filename: "video.mp4",
              type: "Upload",
              progress: Math.floor(Math.random() * 100),
              speed: (Math.random() * 10).toFixed(1),
            }
          ]
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial data
      sendUpdate();

      // Send update every 2 seconds
      const intervalId = setInterval(sendUpdate, 2000);

      req.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
