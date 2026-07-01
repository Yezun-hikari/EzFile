import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const token = cookies().get("ezfile_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await prisma.session.findUnique({ where: { token } });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const link = await prisma.link.findUnique({
      where: { id: params.id },
      include: { files: true }
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const BASE_PATH = process.env.BASE_PATH || path.join(process.cwd(), "storage");

    for (const file of link.files) {
      const fullPath = path.join(BASE_PATH, file.storagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    const linkDir = path.join(BASE_PATH, params.id);
    if (fs.existsSync(linkDir)) {
      fs.rmSync(linkDir, { recursive: true, force: true });
    }

    await prisma.link.delete({ where: { id: params.id } });

    revalidatePath("/admin");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 });
  }
}
