"use client";

import { ExternalLink, FileText } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import EntityListPage, { apiRequest, entityText, dateText } from "@/components/procurement/EntityListPage";
import { Button } from "@/components/ui/Button";

export default function DokumenPage() {
  const columns = [
    { key: "nama", header: "Dokumen", render: (row: any) => entityText(row.nama ?? row.judul ?? row.fileName) },
    { key: "jenis", header: "Jenis", render: (row: any) => entityText(row.jenis) },
    { key: "pengadaan", header: "Pengadaan", render: (row: any) => entityText(row.pengadaan?.judul ?? row.pengadaanId) },
    { key: "createdAt", header: "Tanggal", render: (row: any) => dateText(row.createdAt) },
    {
      key: "file",
      header: "File",
      render: (row: any) =>
        row.filePath || row.url ? (
          <Button size="sm" render={<a href={row.filePath ?? row.url} target="_blank" rel="noreferrer" />}>
            <ExternalLink size={16} /> Buka
          </Button>
        ) : (
          <FileText size={18} />
        ),
    },
  ];
  return (
    <EntityListPage
      title="Dokumen"
      description="Dokumen pengadaan dan berkas pendukung."
      tag="dokumen"
      method="dokumenGetControllerFindAll"
      queryApi={(params) => apiRequest(browserApi.dokumen, "dokumenGetControllerFindAll", params)}
      columns={columns}
    />
  );
}
