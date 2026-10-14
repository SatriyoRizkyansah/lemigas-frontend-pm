"use client";

import { Check, Clock3 } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { getApiErrorMessage } from "@/lib/api/errors";
import { entityText, unwrapEntityList } from "@/components/procurement/EntityListPage";
import { Button } from "@/components/ui/Button";

export default function ApprovalPage() {
  const query = use_query<any[], Error, Record<string, never>>({
    tag: "approval",
    method: "approvalGetControllerFindAll",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return unwrapEntityList(await apiData(browserApi.approval.approvalGetControllerFindAll({ limit: 100, page: 1 }, { format: "json" }) as Promise<{ data: unknown }>));
    },
  });
  const decide = use_mutation<unknown, Error, { pengadaanId: string; stepId: string; keputusan: "disetujui" | "ditolak" }>({
    tag: "approval",
    method: "approvalActionControllerDecide",
    invalidateKeys: [apiQueryKeys.resource("approval")],
    mutationFn: async ({ pengadaanId, stepId, keputusan }) => {
      setBrowserToken();
      return apiData(browserApi.approval.approvalActionControllerDecide(pengadaanId, stepId, { decision: keputusan, catatan: "" }, { format: "json" }) as Promise<{ data: unknown }>);
    },
  });
  const columns = [
    { key: "nomorSurat", header: "Nomor", render: (row: any) => entityText(row.nomorSurat ?? row.pengadaan?.nomorSurat) },
    { key: "judul", header: "Pengadaan", render: (row: any) => entityText(row.judul ?? row.pengadaan?.judul) },
    { key: "pemohon", header: "Pemohon", render: (row: any) => entityText(row.diajukanOlehUser ?? row.pengadaan?.diajukanOlehUser) },
    { key: "status", header: "Status", render: (row: any) => <span className={`status-pill status-${row.status}`}>{entityText(row.status ?? row.step?.status)}</span> },
    {
      key: "actions",
      header: "Aksi",
      render: (row: any) => (
        <div className="data-actions">
          <Button type="button" size="sm" disabled={decide.isPending || !row.pengadaanId || !row.stepId} onClick={() => decide.mutate({ pengadaanId: row.pengadaanId, stepId: row.stepId, keputusan: "disetujui" })}>
            <Check size={16} /> Setujui
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={decide.isPending || !row.pengadaanId || !row.stepId} onClick={() => decide.mutate({ pengadaanId: row.pengadaanId, stepId: row.stepId, keputusan: "ditolak" })}>
            Tolak
          </Button>
        </div>
      ),
    },
  ];
  return (
    <section className="section page-top">
      <div className="section-head">
        <div>
          <h1 className="page-title">Approval</h1>
          <p>Pengadaan yang menunggu keputusan Anda.</p>
        </div>
        <Clock3 size={20} />
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <div className="dashboard-error" role="alert">
          {getApiErrorMessage(query.error)}{" "}
          <Button variant="link" size="sm" type="button" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <DataTable columns={columns} rows={query.data ?? []} rowKey={(row: any) => row.id} emptyMessage="Tidak ada approval menunggu." />
      )}
      {decide.isError && (
        <p className="form-error" role="alert">
          {getApiErrorMessage(decide.error)}
        </p>
      )}
    </section>
  );
}
