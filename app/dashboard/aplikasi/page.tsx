import type { Metadata } from "next";
import AppCard from "@/components/AppCard";
import { apps } from "@/lib/apps";
import { PageHeader } from "@/components/common/PageHeader";

export const metadata: Metadata = { title: "Aplikasi" };

export default function AplikasiPage() {
  return (
    <section className="space-y-5 py-1">
      <PageHeader title="Aplikasi" description="Semua aplikasi yang dapat Anda akses" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {apps.map((a) => (
          <AppCard key={a.id} app={a} />
        ))}
      </div>
    </section>
  );
}
