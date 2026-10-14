import { ArrowRight, FolderOpen } from "lucide-react";
import type { AppItem } from "@/lib/apps";

export default function AppCard({ app }: { app: AppItem }) {
  const active = app.status === "active";
  return (
    <article className="app-card">
      <div className="app-card-top">
        <span className="app-icon" aria-hidden="true">
          <FolderOpen size={26} />
        </span>
        <span className={`badge ${active ? "badge-ok" : "badge-warn"}`}>
          <i aria-hidden="true" />
          {active ? "Aktif" : "Pemeliharaan"}
        </span>
      </div>
      <h3>{app.name}</h3>
      <p>{app.description}</p>
      {active ? (
        <a className="btn btn-blue btn-block" href={app.href} target="_blank" rel="noopener noreferrer">
          Open app <ArrowRight size={18} aria-hidden="true" />
        </a>
      ) : (
        <button className="btn btn-blue btn-block" disabled>
          Tidak tersedia
        </button>
      )}
    </article>
  );
}
