"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type ApiAlert = { id: number; message: string; variant: "success" | "error"; closing?: boolean };

export function ApiSuccessAlerts() {
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);

  useEffect(() => {
    const showAlert = (variant: ApiAlert["variant"]) => (event: Event) => {
      const message = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (typeof message !== "string" || !message.trim()) return;

      const id = Date.now() + Math.random();
      setAlerts((current) => [...current.slice(-2), { id, message: message.trim(), variant }]);
      window.setTimeout(() => {
        setAlerts((current) => current.map((alert) => (alert.id === id ? { ...alert, closing: true } : alert)));
        window.setTimeout(() => {
          setAlerts((current) => current.filter((alert) => alert.id !== id));
        }, 260);
      }, 5000);
    };

    const showSuccess = showAlert("success");
    const showError = showAlert("error");
    window.addEventListener("api:success", showSuccess);
    window.addEventListener("api:error", showError);
    return () => {
      window.removeEventListener("api:success", showSuccess);
      window.removeEventListener("api:error", showError);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3" aria-live="polite" aria-relevant="additions">
      {alerts.map(({ id, message, variant, closing }) => (
        <Alert
          key={id}
          className={`api-success-alert pr-10 shadow-xl shadow-slate-900/10${variant === "success" ? " border-emerald-200 bg-white text-emerald-950" : " border-red-200 bg-white text-red-950"}${closing ? " api-success-alert-closing" : ""}`}
        >
          <CheckCircle2 className={variant === "success" ? "text-emerald-600" : "text-red-600"} />
          <AlertTitle className="font-semibold">{variant === "success" ? "Berhasil" : "Gagal"}</AlertTitle>
          <AlertDescription className={`mt-1 ${variant === "success" ? "text-emerald-900/80" : "text-red-900/80"}`}>{message}</AlertDescription>
          <button
            type="button"
            onClick={() => setAlerts((current) => current.filter((alert) => alert.id !== id))}
            className="absolute right-3 top-3 rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Tutup notifikasi"
          >
            <X className="size-4" />
          </button>
        </Alert>
      ))}
    </div>
  );
}
