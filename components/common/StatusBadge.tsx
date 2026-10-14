import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type Status = "ok" | "warn" | "danger" | "neutral";

const statusClass: Record<Status, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ children, status = "neutral" }: { children: ReactNode; status?: Status }) {
  return (
    <Badge variant="outline" className={statusClass[status]}>
      {children}
    </Badge>
  );
}
