import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  let adminCount = 0;
  try {
    adminCount = await prisma.admin.count();
  } catch (e) {
    // Database might not be initialized yet
  }

  if (adminCount === 0) {
    redirect("/setup");
  } else {
    redirect("/login");
  }
}
