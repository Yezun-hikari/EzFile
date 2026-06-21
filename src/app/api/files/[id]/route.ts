import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: { link: true }
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const token = cookies().get("ezfile_session")?.value;
    let isAdmin = false;
    
    if (token) {
      const session = await prisma.session.findUnique({ where: { token } });
      if (session && session.expiresAt > new Date()) {
        isAdmin = true;
      }
    }

    // If not admin, check password via request body
    if (!isAdmin) {
      const body = await req.json().catch(() => ({}));
      if (file.link.password && file.link.password !== body.password) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const BASE_PATH = process.env.BASE_PATH || path.join(process.cwd(), "storage");
    const fullPath = path.join(BASE_PATH, file.storagePath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await prisma.file.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
