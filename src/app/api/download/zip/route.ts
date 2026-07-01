import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";

async function generateZipStream(fileIds: string[], password?: string) {
  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return NextResponse.json({ error: "No files specified" }, { status: 400 });
  }

  const files = await prisma.file.findMany({
    where: { id: { in: fileIds } },
    include: { link: true },
  });

  if (files.length === 0) {
    return NextResponse.json({ error: "Files not found" }, { status: 404 });
  }

  const token = cookies().get("ezfile_session")?.value;
  let isAdmin = false;

  if (token) {
    const session = await prisma.session.findUnique({ where: { token } });
    if (session && session.expiresAt > new Date()) {
      isAdmin = true;
    }
  }

  for (const file of files) {
    if (!isAdmin && file.link.type === "DROP_ZONE" && file.link.password && file.link.password !== password) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const totalSize = files.reduce((acc, f) => acc + Number(f.size), 0);
  const isLarge = totalSize > 100 * 1024 * 1024;
  const archive = archiver('zip', {
    store: isLarge,
    zlib: { level: isLarge ? 0 : 3 }
  });

  const stream = new ReadableStream({
    start(controller) {
      archive.on('data', (chunk) => controller.enqueue(new Uint8Array(chunk)));
      archive.on('end', () => controller.close());
      archive.on('error', (err) => controller.error(err));

      const BASE_PATH = process.env.BASE_PATH || path.join(process.cwd(), "storage");
      const names = new Set<string>();

      for (const file of files) {
        const fullPath = path.join(BASE_PATH, file.storagePath);
        if (fs.existsSync(fullPath)) {
          let name = file.originalName;
          let counter = 1;
          while (names.has(name)) {
            const ext = path.extname(file.originalName);
            const base = path.basename(file.originalName, ext);
            name = `${base} (${counter})${ext}`;
            counter++;
          }
          names.add(name);
          archive.file(fullPath, { name });
        }
      }

      archive.finalize();
    }
  });

  return new NextResponse(stream as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="ezfile_download.zip"`,
    }
  });
}

export async function POST(req: Request) {
  try {
    const { fileIds, password } = await req.json();
    return await generateZipStream(fileIds, password);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create zip" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fileIds = url.searchParams.get("fileIds")?.split(",") || [];
    const password = url.searchParams.get("password") || undefined;
    return await generateZipStream(fileIds, password);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create zip" }, { status: 500 });
  }
}
