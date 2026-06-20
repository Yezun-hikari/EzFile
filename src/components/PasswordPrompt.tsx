"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PasswordPrompt({ onAuthSuccess }: { onAuthSuccess: (token: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Real implementation would verify against an API
    // For simplicity, we assume we just pass it to the parent component
    // which then fetches the link details using this password.
    onAuthSuccess(password);
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 border rounded-lg shadow-lg bg-card text-card-foreground">
        <h2 className="text-2xl font-bold text-center mb-6 text-primary">Password Required</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            Unlock
          </Button>
        </form>
      </div>
    </div>
  );
}
