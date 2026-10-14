"use client";

import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import EntityListPage, { entityText } from "@/components/procurement/EntityListPage";
import { StatusBadge } from "@/components/common/StatusBadge";

export default function PenggunaPage() {
  const columns = [
    { key: "nama", header: "Nama", render: (row: any) => entityText(row.nama) },
    { key: "email", header: "Email", render: (row: any) => entityText(row.email) },
    { key: "role", header: "Peran", render: (row: any) => entityText(row.role?.nama ?? row.role?.name ?? row.akses) },
    { key: "unitKerja", header: "Unit kerja", render: (row: any) => entityText(row.unitKerja) },
    { key: "status", header: "Status", render: (row: any) => <StatusBadge status={row.status === "aktif" ? "ok" : row.status === "nonaktif" ? "danger" : "neutral"}>{entityText(row.status)}</StatusBadge> },
  ];
  return (
    <EntityListPage
      title="Pengguna"
      description="Daftar pengguna dan peran sistem."
      tag="user"
      method="userGetControllerFindAll"
      queryApi={(params) => {
        setBrowserToken();
        return apiData(browserApi.user.userGetControllerFindAll(params, { format: "json" }) as Promise<{ data: unknown }>);
      }}
      columns={columns}
    />
  );
}
