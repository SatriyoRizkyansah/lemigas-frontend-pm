"use client";

import { useCallback } from "react";

type ToastOptions = { title?: string; description: string; variant?: "default" | "destructive" };

export function useToast() {
  const toast = useCallback(({ title = "Gagal", description, variant = "destructive" }: ToastOptions) => {
    window.dispatchEvent(new CustomEvent("shadcn:toast", { detail: { title, description, variant } }));
  }, []);
  return { toast };
}
