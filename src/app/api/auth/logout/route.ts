import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("ezfile_session")?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  
  const res = NextResponse.json({ success: true });
  res.cookies.delete("ezfile_session");
  return res;
}
