import { LoadingState } from "@/components/loading/LoadingState";

export default function DashboardLoading() {
  return (
    <section className="py-8" aria-label="Memuat halaman">
      <LoadingState label="Memuat halaman…" />
    </section>
  );
}
