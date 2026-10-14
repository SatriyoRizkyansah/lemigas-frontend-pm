"use client";

import { browserApi } from "@/lib/api/browser-client";
import EntityListPage, { apiRequest, entityText, dateText } from "@/components/procurement/EntityListPage";

export default function AuditLogPage() {
  const columns = [
    { key: "createdAt", header: "Waktu", render: (row: any) => dateText(row.createdAt) },
    { key: "user", header: "Pengguna", render: (row: any) => entityText(row.user?.nama ?? row.user?.email) },
    { key: "aksi", header: "Aksi", render: (row: any) => entityText(row.aksi) },
    { key: "entitas", header: "Entitas", render: (row: any) => entityText(row.entitas ?? row.entity) },
    { key: "detail", header: "Detail", render: (row: any) => entityText(row.detail ?? row.deskripsi) },
  ];
  return (
    <EntityListPage
      title="Audit Log"
      description="Jejak aktivitas perubahan pada sistem pengadaan."
      tag="auditLog"
      method="auditLogGetControllerFindAll"
      queryApi={(params) => apiRequest(browserApi.auditLog, "auditLogGetControllerFindAll", params)}
      columns={columns}
    />
  );
}
