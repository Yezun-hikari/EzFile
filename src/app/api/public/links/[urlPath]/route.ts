import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to handle Prisma BigInt serialization
const serializeBigInts = (link: any) => {
  if (!link) return link;
  return {
    ...link,
    maxSizeLimit: link.maxSizeLimit ? link.maxSizeLimit.toString() : null,
    files: link.files ? link.files.map((f: any) => ({
      ...f,
      size: f.size.toString()
    })) : [],
  };
};

export async function POST(req: Request, { params }: { params: { urlPath: string } }) {
  try {
    const { password } = await req.json();

    const link = await prisma.link.findUnique({
      where: { urlPath: params.urlPath },
      include: { files: true },
    });

    if (!link) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (link.status !== "ACTIVE") {
      return NextResponse.json({ error: "Link expired or unavailable" }, { status: 403 });
    }

    if (link.password && link.password !== password) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Update usage if it's a SHARE link
    if (link.type === "SHARE") {
      await prisma.link.update({
        where: { id: link.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ link: serializeBigInts(link) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// GET without password (only works if no password is set)
export async function GET(req: Request, { params }: { params: { urlPath: string } }) {
  try {
    const link = await prisma.link.findUnique({
      where: { urlPath: params.urlPath },
      include: { files: true },
    });

    if (!link || link.status !== "ACTIVE") {
      return NextResponse.json({ error: "Not found or expired" }, { status: 404 });
    }

    if (link.password) {
      return NextResponse.json({ requirePassword: true });
    }

    if (link.type === "SHARE") {
      await prisma.link.update({
        where: { id: link.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ link: serializeBigInts(link) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
