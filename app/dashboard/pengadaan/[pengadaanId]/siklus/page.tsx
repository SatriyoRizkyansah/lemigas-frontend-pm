import type { Metadata } from "next";
import LifecyclePage from "@/components/workflow/LifecyclePage";
export const metadata: Metadata = { title: "Siklus Pengadaan" };
export default function SiklusPage({ params }: { params: { pengadaanId: string } }) {
  return <LifecyclePage pengadaanId={params.pengadaanId} />;
}
