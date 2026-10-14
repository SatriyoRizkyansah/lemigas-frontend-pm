import type { ReactNode } from "react";

export function EmptyState({ title = "Belum ada data", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
