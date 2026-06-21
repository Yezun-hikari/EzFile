import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

export async function DELETE(req: Request) {
  try {
    const { fileIds, password } = await req.json();

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "No files specified" }, { status: 400 });
    }

    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      include: { link: true }
    });

    if (files.length === 0) {
      return NextResponse.json({ success: true });
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

    const BASE_PATH = process.env.BASE_PATH || path.join(process.cwd(), "storage");

    for (const file of files) {
      const fullPath = path.join(BASE_PATH, file.storagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      await prisma.file.delete({ where: { id: file.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete files" }, { status: 500 });
  }
}
