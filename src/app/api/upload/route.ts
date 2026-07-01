import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transferManager } from "@/lib/transferManager";
import fs from "fs";
import path from "path";

const BASE_PATH = process.env.BASE_PATH || "./storage";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const linkId = url.searchParams.get("linkId");
    const filename = url.searchParams.get("filename");
    const chunkIndex = parseInt(url.searchParams.get("chunkIndex") || "0");
    const totalChunks = parseInt(url.searchParams.get("totalChunks") || "1");
    const totalSize = parseInt(url.searchParams.get("totalSize") || "0");
    const startOffset = parseInt(url.searchParams.get("startOffset") || "0");
    
    if (!linkId || !filename) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const linkDir = path.join(BASE_PATH, linkId);
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(linkDir, safeFilename);
    const trackerDir = path.join(linkDir, `.tracker_${safeFilename}`);

    // Chunk 0: initialize structure and clean old files
    if (chunkIndex === 0) {
      const link = await prisma.link.findUnique({ where: { id: linkId } });
      if (!link) {
        return NextResponse.json({ error: "Link not found" }, { status: 404 });
      }
      if (!fs.existsSync(linkDir)) {
        fs.mkdirSync(linkDir, { recursive: true });
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(trackerDir)) {
        fs.rmSync(trackerDir, { recursive: true, force: true });
      }
      fs.mkdirSync(trackerDir, { recursive: true });
      
      if (link.type === "FILE_TUNNEL") {
        await prisma.file.deleteMany({
          where: {
            linkId: linkId,
            storagePath: `${linkId}/${safeFilename}`,
          },
        });
        await prisma.file.create({
          data: {
            linkId: linkId,
            originalName: filename,
            storagePath: `${linkId}/${safeFilename}`,
            size: BigInt(totalSize),
            mimeType: "application/octet-stream",
            isComplete: false,
          },
        });
      }

      const transferId = `upload-${linkId}-${safeFilename}`;
      transferManager.startTransfer(transferId, filename, "UPLOAD", totalSize);
    } else if (!fs.existsSync(linkDir)) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    if (!fs.existsSync(trackerDir)) {
      fs.mkdirSync(trackerDir, { recursive: true });
    }

    // Read chunk buffer
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Positional write to allow out-of-order concurrent writes
    const fd = fs.openSync(filePath, fs.existsSync(filePath) ? "r+" : "w+");
    fs.writeSync(fd, buffer, 0, buffer.length, startOffset);
    fs.closeSync(fd);

    // Mark chunk as completed
    const markerPath = path.join(trackerDir, `done_${chunkIndex}`);
    fs.writeFileSync(markerPath, "");

    const doneCount = fs.readdirSync(trackerDir).length;
    const transferId = `upload-${linkId}-${safeFilename}`;
    const approxBytes = Math.min(doneCount * buffer.length, totalSize);
    transferManager.updateTransfer(transferId, approxBytes);

    if (doneCount === totalChunks) {
      // All chunks completed
      fs.rmSync(trackerDir, { recursive: true, force: true });
      const stats = fs.statSync(filePath);
      
      const existingFile = await prisma.file.findFirst({
        where: {
          linkId: linkId,
          storagePath: `${linkId}/${safeFilename}`,
        },
      });

      if (existingFile) {
        await prisma.file.update({
          where: { id: existingFile.id },
          data: {
            size: BigInt(stats.size),
            isComplete: true,
          },
        });
      } else {
        await prisma.file.create({
          data: {
            linkId: linkId,
            originalName: filename,
            storagePath: `${linkId}/${safeFilename}`,
            size: BigInt(stats.size),
            mimeType: "application/octet-stream",
            isComplete: true,
          },
        });
      }

      transferManager.completeTransfer(transferId);
      return NextResponse.json({ success: true, complete: true });
    }

    return NextResponse.json({ success: true, complete: false });
  } catch (error) {
    console.error(error);
    const url = new URL(req.url);
    const linkId = url.searchParams.get("linkId");
    const filename = url.searchParams.get("filename");
    if (linkId && filename) {
      const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      transferManager.failTransfer(`upload-${linkId}-${safeFilename}`);
    }
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
