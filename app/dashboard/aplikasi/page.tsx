import type { Metadata } from "next";
import AppCard from "@/components/AppCard";
import { apps } from "@/lib/apps";

export const metadata: Metadata = { title: "Aplikasi" };

export default function AplikasiPage() {
  return (
    <section className="section page-top">
      <div className="section-head">
        <div>
          <h1 className="page-title">Aplikasi</h1>
          <p>Semua aplikasi yang dapat Anda akses</p>
        </div>
      </div>
      <div className="app-grid">
        {apps.map((a) => (
          <AppCard key={a.id} app={a} />
        ))}
      </div>
    </section>
  );
}
