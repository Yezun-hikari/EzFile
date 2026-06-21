"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function AdminLinkActions({ linkId, status }: { linkId: string, status: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleUpdate = async (newStatus: string) => {
    setLoading(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/links/${linkId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Success", description: `Link marked as ${newStatus}`, type: "success" });
      router.refresh();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update link status", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${basePath}/api/links/${linkId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast({ title: "Success", description: "Link completely deleted", type: "success" });
      router.refresh();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete link", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {status === "EXPIRED" ? (
        <Button 
          variant="outline" 
          size="sm" 
          className="text-primary border-primary hover:bg-primary hover:text-primary-foreground"
          onClick={() => handleUpdate("ACTIVE")}
          disabled={loading}
        >
          Reactivate
        </Button>
      ) : (
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => handleUpdate("EXPIRED")}
          disabled={loading}
        >
          Expire
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setShowDeleteModal(true)}
        disabled={loading}
        title="Delete completely"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete Link"
        description="Are you sure you want to completely delete this link? This action will permanently remove the link and all associated files from the storage."
        confirmText="Delete"
        isDestructive={true}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
