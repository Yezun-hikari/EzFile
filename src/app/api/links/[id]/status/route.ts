import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const token = cookies().get("ezfile_session")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status } = await req.json();

    if (status !== "ACTIVE" && status !== "EXPIRED") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const link = await prisma.link.update({
      where: { id: params.id },
      data: { status },
    });

    revalidatePath("/admin");

    return NextResponse.json({ link });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update link status" }, { status: 500 });
  }
}
