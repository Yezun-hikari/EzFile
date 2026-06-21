"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLinkActions({ linkId, status }: { linkId: string, status: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  if (status === "EXPIRED") {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        className="text-primary border-primary hover:bg-primary hover:text-primary-foreground"
        onClick={() => handleUpdate("ACTIVE")}
        disabled={loading}
      >
        Reactivate
      </Button>
    );
  }

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      onClick={() => handleUpdate("EXPIRED")}
      disabled={loading}
    >
      Expire
    </Button>
  );
}
