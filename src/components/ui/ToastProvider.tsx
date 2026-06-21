"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: ToastType;
}

interface ToastContextType {
  toast: (message: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((message: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...message, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5 bg-card text-card-foreground ${
              t.type === "error" ? "border-destructive/50 bg-destructive/10" :
              t.type === "success" ? "border-green-500/50 bg-green-500/10" : ""
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}
              {t.type === "success" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {(!t.type || t.type === "info") && <Info className="h-5 w-5 text-primary" />}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-muted-foreground hover:text-foreground shrink-0 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
