"use client";

import { CheckCheck } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { getApiErrorMessage } from "@/lib/api/errors";
import { dateText, entityText, unwrapEntityList } from "@/components/procurement/EntityListPage";
import { Button } from "@/components/ui/legacy-button";

export default function NotifikasiPage() {
  const query = use_query<any[], Error, Record<string, never>>({
    tag: "notifikasi",
    method: "notifikasiGetControllerFindAll",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return unwrapEntityList(await apiData(browserApi.notifikasi.notifikasiGetControllerFindAll({ limit: 100, page: 1 }, { format: "json" }) as Promise<{ data: unknown }>));
    },
  });
  const markRead = use_mutation<unknown, Error, string>({
    tag: "notifikasi",
    method: "notifikasiPutControllerMarkAsRead",
    invalidateKeys: [apiQueryKeys.resource("notifikasi")],
    mutationFn: async (id) => {
      setBrowserToken();
      return apiData(browserApi.notifikasi.notifikasiPutControllerMarkAsRead(id, { format: "json" }) as Promise<{ data: unknown }>);
    },
  });
  const markAll = use_mutation<unknown, Error, void>({
    tag: "notifikasi",
    method: "notifikasiPutControllerMarkAllAsRead",
    invalidateKeys: [apiQueryKeys.resource("notifikasi")],
    mutationFn: async () => {
      setBrowserToken();
      return apiData(browserApi.notifikasi.notifikasiPutControllerMarkAllAsRead({ format: "json" }) as Promise<{ data: unknown }>);
    },
  });
  const columns = [
    { key: "title", header: "Notifikasi", render: (row: any) => <strong>{entityText(row.judul ?? row.title ?? row.pesan)}</strong> },
    { key: "message", header: "Pesan", render: (row: any) => entityText(row.pesan ?? row.message ?? row.deskripsi) },
    { key: "date", header: "Tanggal", render: (row: any) => dateText(row.createdAt) },
    { key: "status", header: "Status", render: (row: any) => entityText(row.dibaca ? "dibaca" : (row.status ?? "belum dibaca")) },
    {
      key: "action",
      header: "Aksi",
      render: (row: any) =>
        row.dibaca ? (
          "—"
        ) : (
          <Button type="button" variant="dark" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(row.id)}>
            Tandai dibaca
          </Button>
        ),
    },
  ];
  return (
    <section className="section page-top">
      <div className="section-head">
        <div>
          <h1 className="page-title">Notifikasi</h1>
          <p>Informasi terbaru terkait pengadaan Anda.</p>
        </div>
        <Button type="button" variant="primary" size="md" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          <CheckCheck size={16} /> Tandai semua dibaca
        </Button>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <div className="dashboard-error" role="alert">
          {getApiErrorMessage(query.error)} <button onClick={() => void query.refetch()}>Coba lagi</button>
        </div>
      ) : (
        <DataTable columns={columns} rows={query.data ?? []} rowKey={(row: any) => row.id} emptyMessage="Belum ada notifikasi." />
      )}
      {(markRead.isError || markAll.isError) && (
        <p className="form-error" role="alert">
          {getApiErrorMessage(markRead.error ?? markAll.error)}
        </p>
      )}
    </section>
  );
}
