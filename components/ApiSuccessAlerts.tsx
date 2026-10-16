"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SuccessAlert = { id: number; message: string; closing?: boolean };

export function ApiSuccessAlerts() {
  const [alerts, setAlerts] = useState<SuccessAlert[]>([]);

  useEffect(() => {
    const showAlert = (event: Event) => {
      const message = (event as CustomEvent<{ message?: unknown }>).detail?.message;
      if (typeof message !== "string" || !message.trim()) return;

      const id = Date.now() + Math.random();
      setAlerts((current) => [...current.slice(-2), { id, message: message.trim() }]);
      window.setTimeout(() => {
        setAlerts((current) => current.map((alert) => (alert.id === id ? { ...alert, closing: true } : alert)));
        window.setTimeout(() => {
          setAlerts((current) => current.filter((alert) => alert.id !== id));
        }, 260);
      }, 5000);
    };

    window.addEventListener("api:success", showAlert);
    return () => window.removeEventListener("api:success", showAlert);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[200] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3" aria-live="polite" aria-relevant="additions">
      {alerts.map(({ id, message, closing }) => (
        <Alert key={id} className={`api-success-alert border-emerald-200 bg-white pr-10 text-emerald-950 shadow-xl shadow-slate-900/10${closing ? " api-success-alert-closing" : ""}`}>
          <CheckCircle2 className="text-emerald-600" />
          <AlertTitle className="font-semibold">Berhasil</AlertTitle>
          <AlertDescription className="mt-1 text-emerald-900/80">{message}</AlertDescription>
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
