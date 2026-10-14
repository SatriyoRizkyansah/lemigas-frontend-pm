"use client";

import Link from "next/link";
import { browserApi } from "@/lib/api/browser-client";
import EntityListPage, { apiRequest, entityText, dateText } from "@/components/procurement/EntityListPage";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function PengadaanPage() {
  const columns = [
    { key: "nomorSurat", header: "Nomor Surat", render: (row: any) => entityText(row.nomorSurat) },
    { key: "judul", header: "Judul", render: (row: any) => entityText(row.judul) },
    { key: "metode", header: "Metode", render: (row: any) => entityText(row.metode) },
    {
      key: "status",
      header: "Status",
      render: (row: any) => <StatusBadge status={row.status === "selesai" || row.status === "disetujui" ? "ok" : row.status === "ditolak" || row.status === "dibatalkan" ? "danger" : "warn"}>{entityText(row.status)}</StatusBadge>,
    },
    { key: "createdAt", header: "Dibuat", render: (row: any) => dateText(row.createdAt) },
    {
      key: "actions",
      header: "Aksi",
      render: (row: any) => (
        <Button size="sm" render={<Link href={`/dashboard/pengadaan/${row.id}/siklus`} />}>
          Siklus
        </Button>
      ),
    },
  ];
  return (
    <EntityListPage
      title="Pengadaan"
      description="Daftar pengadaan minyak dan transaksi berjalan."
      tag="pengadaan"
      method="pengadaanGetControllerFindAll"
      queryApi={(params) => apiRequest(browserApi.pengadaan, "pengadaanGetControllerFindAll", params)}
      columns={columns}
      filters={[
        { field: "status", label: "Status", options: ["draft", "diajukan", "dalam_review", "disetujui", "ditolak", "revisi", "sedang_proses", "selesai", "dibatalkan"].map((value) => ({ value, label: entityText(value) })) },
        { field: "metode", label: "Metode", options: ["tender", "pengadaan_langsung", "penunjukan_langsung", "e_procurement"].map((value) => ({ value, label: entityText(value) })) },
      ]}
    />
  );
}
