import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { urlPath, type, password, maxUsage, expiresAt, maxSizeLimit } = data;

    // Generate a random path if none provided
    const path = urlPath || crypto.randomBytes(4).toString("hex");

    const existing = await prisma.link.findUnique({ where: { urlPath: path } });
    if (existing) {
      return NextResponse.json({ error: "URL Path already exists" }, { status: 400 });
    }

    const link = await prisma.link.create({
      data: {
        urlPath: path,
        type: type || "SHARE",
        password: password || null,
        maxUsage: maxUsage ? parseInt(maxUsage) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxSizeLimit: maxSizeLimit ? BigInt(maxSizeLimit) : null,
        status: "ACTIVE", // Or PENDING if files are uploading
      },
    });

    revalidatePath("/admin");

    return NextResponse.json({ link });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const links = await prisma.link.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { files: true } } },
    });
    return NextResponse.json({ links });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 });
  }
}
