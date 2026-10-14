"use client";

import Link from "next/link";
import { browserApi } from "@/lib/api/browser-client";
import EntityListPage, { apiRequest, entityText, dateText } from "@/components/procurement/EntityListPage";

export default function PengadaanPage() {
  const columns = [
    { key: "nomorSurat", header: "Nomor Surat", render: (row: any) => entityText(row.nomorSurat) },
    { key: "judul", header: "Judul", render: (row: any) => entityText(row.judul) },
    { key: "metode", header: "Metode", render: (row: any) => entityText(row.metode) },
    { key: "status", header: "Status", render: (row: any) => <span className={`status-pill status-${row.status}`}>{entityText(row.status)}</span> },
    { key: "createdAt", header: "Dibuat", render: (row: any) => dateText(row.createdAt) },
    {
      key: "actions",
      header: "Aksi",
      render: (row: any) => (
        <Link className="btn btn-dark" href={`/dashboard/pengadaan/${row.id}/siklus`}>
          Siklus
        </Link>
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
