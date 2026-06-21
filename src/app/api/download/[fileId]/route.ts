import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transferManager } from "@/lib/transferManager";
import { Transform } from "stream";
import fs from "fs";
import path from "path";

const BASE_PATH = process.env.BASE_PATH || "./storage";

export async function GET(req: Request, { params }: { params: { fileId: string } }) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: params.fileId },
      include: { link: true },
    });

    if (!file || file.link.status !== "ACTIVE") {
      return new NextResponse("Not Found", { status: 404 });
    }

    const filePath = path.join(BASE_PATH, file.storagePath);
    if (!fs.existsSync(filePath)) {
      return new NextResponse("File missing on disk", { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const rangeHeader = req.headers.get("range");

    const transferId = `download-${file.id}-${Date.now()}`;
    transferManager.startTransfer(transferId, file.originalName, "DOWNLOAD", totalSize);

    let bytesDownloaded = 0;
    const progressStream = new Transform({
      transform(chunk, encoding, callback) {
        bytesDownloaded += chunk.length;
        transferManager.updateTransfer(transferId, bytesDownloaded);
        callback(null, chunk);
      },
      flush(callback) {
        transferManager.completeTransfer(transferId);
        callback();
      }
    });

    // Handle unexpected close/error
    progressStream.on('error', () => transferManager.failTransfer(transferId));
    progressStream.on('close', () => {
      if (bytesDownloaded < totalSize) {
        // Only fail if it closed before completing
        transferManager.failTransfer(transferId);
      }
    });

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunksize = (end - start) + 1;
      
      const fileStream = fs.createReadStream(filePath, { start, end });
      const pipedStream = fileStream.pipe(progressStream);
      
      const res = new NextResponse(pipedStream as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": file.mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        },
      });
      return res;
    } else {
      const fileStream = fs.createReadStream(filePath);
      const pipedStream = fileStream.pipe(progressStream);
      return new NextResponse(pipedStream as unknown as ReadableStream, {
        headers: {
          "Content-Length": totalSize.toString(),
          "Content-Type": file.mimeType,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        },
      });
    }
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
