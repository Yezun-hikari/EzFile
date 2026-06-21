"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SetupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const res = await fetch(`${basePath}/api/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      router.push("/login");
    } else {
      const data = await res.json();
      setError(data.error || "Failed to initialize");
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 border rounded-lg shadow-lg bg-card text-card-foreground">
        <h1 className="text-3xl font-bold text-primary mb-2 text-center">EzFile</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          First Launch Setup. Create the admin account.
        </p>

        <form onSubmit={handleSetup} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Username</label>
            <Input 
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Password</label>
            <Input 
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-destructive text-sm">{error}</div>}
          <Button type="submit" className="w-full">
            Complete Setup
          </Button>
        </form>
      </div>
    </div>
  );
}
