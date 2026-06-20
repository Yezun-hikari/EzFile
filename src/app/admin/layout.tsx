import Link from "next/link";
import { FolderUp, Link as LinkIcon, Activity, LogOut, PlusCircle } from "lucide-react";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
            <FolderUp className="w-6 h-6" />
            EzFile
          </h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/admin/create" className="flex items-center gap-3 px-3 py-2 rounded-md bg-primary text-primary-foreground font-medium mb-6 hover:bg-primary/90 transition-colors">
            <PlusCircle className="w-5 h-5" />
            Create Link
          </Link>
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground font-medium transition-colors">
            <LinkIcon className="w-5 h-5" />
            Links
          </Link>
          <Link href="/admin/transfers" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground font-medium transition-colors">
            <Activity className="w-5 h-5" />
            Active Transfers
          </Link>
        </nav>

        <div className="p-4 border-t">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex w-full items-center gap-3 px-3 py-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive font-medium transition-colors">
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
