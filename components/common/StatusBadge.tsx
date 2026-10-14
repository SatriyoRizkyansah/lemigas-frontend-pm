import type { ReactNode } from "react";

type Status = "ok" | "warn" | "danger" | "neutral";

export function StatusBadge({ children, status = "neutral" }: { children: ReactNode; status?: Status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
