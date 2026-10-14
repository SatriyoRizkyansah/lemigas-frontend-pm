import { LoadingState } from "@/components/loading/LoadingState";

export default function DashboardLoading() {
  return (
    <section className="dashboard-loading" aria-label="Memuat halaman">
      <LoadingState label="Memuat halaman…" />
    </section>
  );
}
