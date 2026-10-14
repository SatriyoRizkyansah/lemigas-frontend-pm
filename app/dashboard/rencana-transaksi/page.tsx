"use client";

import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import EntityListPage, { entityText } from "@/components/procurement/EntityListPage";

export default function RencanaTransaksiPage() {
  const columns = [
    { key: "nomor", header: "Nomor", render: (row: any) => entityText(row.nomor ?? row.nomorPenugasan) },
    { key: "modelPelaksanaan", header: "Model", render: (row: any) => entityText(row.modelPelaksanaan) },
    { key: "jenisKargo", header: "Jenis kargo", render: (row: any) => entityText(row.jenisKargo) },
    { key: "status", header: "Status", render: (row: any) => <span className={`status-pill status-${row.status}`}>{entityText(row.status)}</span> },
  ];
  return (
    <EntityListPage
      title="Rencana Transaksi"
      description="Rencana kebutuhan dan transaksi komoditas."
      tag="perencanaan"
      method="perencanaanControllerFindAll"
      queryApi={() => {
        setBrowserToken();
        return apiData(browserApi.ePlanningTransaksi.perencanaanControllerFindAll({ format: "json" }) as Promise<{ data: unknown }>);
      }}
      columns={columns}
    />
  );
}
