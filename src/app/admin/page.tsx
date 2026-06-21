import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { AdminLinkActions } from "@/components/AdminLinkActions";
import { CopyUrl } from "@/components/CopyUrl";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const links = await prisma.link.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { files: true } } },
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Manage Links</h2>
          <p className="text-muted-foreground">Create and manage your shared files and drop-zones.</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/admin/create">
            <PlusCircle className="w-5 h-5" />
            Create Link
          </Link>
        </Button>
      </div>

      <div className="border rounded-md">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground uppercase">
            <tr>
              <th className="px-6 py-3 font-medium">URL Path</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Files</th>
              <th className="px-6 py-3 font-medium">Usage</th>
              <th className="px-6 py-3 font-medium">Password</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Created</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                  No links created yet.
                </td>
              </tr>
            ) : (
              links.map((link) => (
                <tr key={link.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-6 py-4 font-medium"><CopyUrl urlPath={link.urlPath} /></td>
                  <td className="px-6 py-4">{link.type}</td>
                  <td className="px-6 py-4">{link._count.files}</td>
                  <td className="px-6 py-4">
                    {link.usageCount} {link.maxUsage ? `/ ${link.maxUsage}` : ""}
                  </td>
                  <td className="px-6 py-4 font-mono text-muted-foreground">
                    {link.password || "None"}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      link.status === "ACTIVE" ? "bg-primary/20 text-primary" : 
                      link.status === "EXPIRED" ? "bg-destructive/20 text-destructive" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {link.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <AdminLinkActions linkId={link.id} status={link.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
