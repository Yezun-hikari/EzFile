import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const BASE_PATH = process.env.BASE_PATH || path.join(process.cwd(), "storage");

// Run every hour
cron.schedule("0 * * * *", async () => {
  console.log("[Worker] Running cleanup job...");
  try {
    const now = new Date();
    
    // First, expire links that have passed their expiration date
    const expiredLinks = await prisma.link.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: {
          lte: now,
        },
      },
      data: {
        status: "EXPIRED",
      },
    });
    
    if (expiredLinks.count > 0) {
      console.log(`[Worker] Expired ${expiredLinks.count} links.`);
    }

    // Next, find EXPIRED links older than 7 days
    const gracePeriodThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // We need to fetch them to delete files
    const linksToDelete = await prisma.link.findMany({
      where: {
        status: "EXPIRED",
        // Using updatedAt assuming it was updated when status changed to EXPIRED
        updatedAt: {
          lte: gracePeriodThreshold,
        },
      },
      include: {
        files: true,
      },
    });

    for (const link of linksToDelete) {
      try {
        console.log(`[Worker] Hard deleting link ${link.id}...`);
        
        for (const file of link.files) {
          const fullPath = path.join(BASE_PATH, file.storagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }

        const linkDir = path.join(BASE_PATH, link.id);
        if (fs.existsSync(linkDir)) {
          fs.rmSync(linkDir, { recursive: true, force: true });
        }
        
        await prisma.link.delete({
          where: { id: link.id },
        });
      } catch (linkErr) {
        console.error(`[Worker] Failed to delete link ${link.id}:`, linkErr);
      }
    }

    if (linksToDelete.length > 0) {
      console.log(`[Worker] Deleted ${linksToDelete.length} links after grace period.`);
    }
  } catch (error) {
    console.error("[Worker] Error running cleanup job:", error);
  }
});

console.log("[Worker] Cron worker started.");
