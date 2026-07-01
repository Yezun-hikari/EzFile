import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transferManager } from "@/lib/transferManager";
import { Transform, Readable } from "stream";
import fs from "fs";
import path from "path";

const BASE_PATH = process.env.BASE_PATH || "./storage";

export async function GET(req: Request, { params }: { params: { fileId: string } }) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: params.fileId },
      include: { link: true },
    });

    if (!file || file.link.status !== "ACTIVE" || (file.link.expiresAt && new Date(file.link.expiresAt) <= new Date()) || (file.link.maxUsage !== null && file.link.usageCount >= file.link.maxUsage)) {
      if (file && file.link.status === "ACTIVE") {
        await prisma.link.update({ where: { id: file.link.id }, data: { status: "EXPIRED" } });
      }
      return new NextResponse("Not Found or Expired", { status: 404 });
    }

    const filePath = path.join(BASE_PATH, file.storagePath);
    if (!fs.existsSync(filePath) && file.isComplete) {
      return new NextResponse("File missing on disk", { status: 404 });
    }

    const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
    const totalSize = file.isComplete && stat ? stat.size : Number(file.size);
    const rangeHeader = req.headers.get("range");
    const etag = `"${file.id}-${totalSize}"`;
    const lastModified = stat ? stat.mtime.toUTCString() : file.createdAt.toUTCString();

    const commonHeaders: Record<string, string> = {
      "Accept-Ranges": "bytes",
      "ETag": etag,
      "Last-Modified": lastModified,
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    };

    let startOffset = 0;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const parsedStart = parseInt(parts[0], 10);
      if (!isNaN(parsedStart) && parsedStart > 0 && parsedStart < totalSize) {
        startOffset = parsedStart;
      }
    }

    const transferId = `download-${file.id}-${Date.now()}`;
    transferManager.startTransfer(transferId, file.originalName, "DOWNLOAD", totalSize);

    let bytesDownloaded = startOffset;
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

    progressStream.on('error', () => transferManager.failTransfer(transferId));
    progressStream.on('close', () => {
      if (bytesDownloaded < totalSize) {
        transferManager.failTransfer(transferId);
      }
    });

    if (!file.isComplete) {
      const CHUNK_SIZE = totalSize > 100 * 1024 * 1024 ? 16 * 1024 * 1024 : 8 * 1024 * 1024;
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      const safeFilename = path.basename(filePath);
      const trackerDir = path.join(path.dirname(filePath), `.tracker_${safeFilename}`);

      let currentChunk = 0;
      const liveStream = new Readable({
        async read() {
          while (currentChunk < totalChunks) {
            const markerPath = path.join(trackerDir, `done_${currentChunk}`);
            const isCompleted = fs.existsSync(markerPath);
            const dbFile = await prisma.file.findUnique({ where: { id: file.id } });

            if (isCompleted || dbFile?.isComplete) {
              const start = currentChunk * CHUNK_SIZE;
              const end = Math.min((currentChunk + 1) * CHUNK_SIZE - 1, totalSize - 1);
              try {
                const chunkBuffer = await new Promise<Buffer>((resolve, reject) => {
                  const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });
                  const chunks: Buffer[] = [];
                  stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
                  stream.on("end", () => resolve(Buffer.concat(chunks)));
                  stream.on("error", reject);
                });
                currentChunk++;
                this.push(chunkBuffer);
                return;
              } catch (err) {
                // Wait briefly if file lock
              }
            }
            await new Promise((r) => setTimeout(r, 250));
          }
          this.push(null);
        }
      });

      const pipedStream = liveStream.pipe(progressStream);
      return new NextResponse(Readable.toWeb(pipedStream) as unknown as ReadableStream, {
        headers: {
          ...commonHeaders,
          "Content-Length": totalSize.toString(),
        },
      });
    }

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] && parts[1].trim() !== "" ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || start < 0 || start >= totalSize || end >= totalSize || start > end) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: {
            "Content-Range": `bytes */${totalSize}`,
            "Accept-Ranges": "bytes",
          },
        });
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });
      const pipedStream = fileStream.pipe(progressStream);

      return new NextResponse(Readable.toWeb(pipedStream) as unknown as ReadableStream, {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Content-Length": chunksize.toString(),
        },
      });
    } else {
      const fileStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
      const pipedStream = fileStream.pipe(progressStream);
      return new NextResponse(Readable.toWeb(pipedStream) as unknown as ReadableStream, {
        headers: {
          ...commonHeaders,
          "Content-Length": totalSize.toString(),
        },
      });
    }
  } catch (error) {
    console.error(error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
