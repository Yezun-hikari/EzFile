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
    
    if (!linkId || !filename) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const link = await prisma.link.findUnique({ where: { id: linkId } });
    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    // Ensure storage directory exists
    if (!fs.existsSync(BASE_PATH)) {
      fs.mkdirSync(BASE_PATH, { recursive: true });
    }
    const linkDir = path.join(BASE_PATH, link.id);
    if (!fs.existsSync(linkDir)) {
      fs.mkdirSync(linkDir, { recursive: true });
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const filePath = path.join(linkDir, safeFilename);

    // Read chunk from request body
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Append chunk to file
    if (chunkIndex === 0 && fs.existsSync(filePath)) {
      // Start fresh if it's the first chunk
      fs.unlinkSync(filePath);
    }
    
    // TransferManager logic
    const transferId = `upload-${linkId}-${safeFilename}`;
    if (chunkIndex === 0) {
      transferManager.startTransfer(transferId, filename, "UPLOAD", totalSize);
    }

    fs.appendFileSync(filePath, buffer);

    // Update progress
    const currentSize = fs.statSync(filePath).size;
    transferManager.updateTransfer(transferId, currentSize);

    if (chunkIndex === totalChunks - 1) {
      // Last chunk, create File record in DB
      const stats = fs.statSync(filePath);
      
      await prisma.file.create({
        data: {
          linkId: link.id,
          originalName: filename,
          storagePath: `${link.id}/${safeFilename}`,
          size: BigInt(stats.size),
          mimeType: "application/octet-stream", // Could be inferred
        },
      });

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
