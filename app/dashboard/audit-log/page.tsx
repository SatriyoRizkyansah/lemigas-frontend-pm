"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { getApiErrorMessage } from "@/lib/api/errors";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type AuditRecord = {
  id: string;
  tabel: string;
  recordId: string;
  aksi: string;
  createdAt: string;
  dilakukanOleh?: string | null;
  dilakukanOlehUser?: { nama?: string; email?: string } | null;
  dataSebelum?: unknown;
  dataSesudah?: unknown;
};
type AuditPayload = { data: AuditRecord[]; pagination?: { total_datas: number; total_pages: number } };
type Filters = { tabel: string; recordId: string; aksi: string; query: string; page: number; limit: number; byRecord: boolean };

function payload(value: unknown, byRecord: boolean): AuditPayload {
  let current = value;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if (Array.isArray(current) && byRecord) return { data: current as AuditRecord[] };
    if ("data" in current && Array.isArray(current.data)) {
      if (!byRecord && !("pagination" in current && current.pagination && typeof current.pagination === "object" && "total_datas" in current.pagination && "total_pages" in current.pagination)) break;
      return current as AuditPayload;
    }
    if (!("data" in current)) break;
    current = current.data;
  }
  throw new Error("Response audit log tidak valid.");
}
const recordUrl = (tabel: string, recordId: string) => `/dashboard/audit-log?${new URLSearchParams({ tabel, recordId, mode: "record" })}`;

function AuditView({ initial }: { initial: Filters }) {
  const [filters, setFilters] = useState(initial);
  const [selected, setSelected] = useState<AuditRecord | null>(null);
  const user = useCurrentUser();
  const canAudit = user.isSuccess && !user.isRefetchError && ["admin", "pimpinan"].includes(user.data.role.toLowerCase());
  const validRecord = Boolean(filters.tabel.trim() && filters.recordId.trim());
  const allowed = canAudit && (!filters.byRecord || validRecord);
  const query = use_query<AuditPayload, Error, Filters>({
    tag: "auditLog",
    method: filters.byRecord ? "auditLogGetControllerFindByRecord" : "auditLogGetControllerFindAll",
    params: filters,
    enabled: allowed,
    queryFn: async ({ byRecord, tabel, recordId, aksi, query: search, page, limit }) => {
      setBrowserToken();
      const request = byRecord
        ? browserApi.auditLog.auditLogGetControllerFindByRecord(encodeURIComponent(tabel.trim()), encodeURIComponent(recordId.trim()), { format: "json" })
        : browserApi.auditLog.auditLogGetControllerFindAll({ tabel: tabel.trim() || undefined, recordId: recordId.trim() || undefined, aksi: aksi.trim() || undefined, query: search.trim() || undefined, page, limit }, { format: "json" });
      return payload(await apiData(request as Promise<{ data: unknown }>), byRecord);
    },
  });
  function update(values: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...values, page: 1 }));
  }
  const records = query.data?.data ?? [];
  // by-record endpoint returns all rows, without server-side filters or pagination.
  const filtered = filters.byRecord
    ? records.filter(
        (row) =>
          (!filters.aksi.trim() || row.aksi.toLowerCase() === filters.aksi.trim().toLowerCase()) &&
          (!filters.query.trim() || [row.tabel, row.aksi, row.recordId].some((value) => value.toLowerCase().includes(filters.query.trim().toLowerCase()))),
      )
    : records;
  const total = filters.byRecord ? filtered.length : (query.data?.pagination?.total_datas ?? 0);
  const totalPages = Math.max(1, filters.byRecord ? Math.ceil(total / filters.limit) : (query.data?.pagination?.total_pages ?? 1));
  const page = Math.min(filters.page, totalPages);
  const rows = filters.byRecord ? filtered.slice((page - 1) * filters.limit, page * filters.limit) : filtered;
  return (
    <section className="space-y-5 py-1">
      <PageHeader title="Audit Log" description="Jejak perubahan: pelaku, aksi, tabel, record, serta data sebelum dan sesudah." />
      <div className="flex flex-wrap gap-2" aria-label="Tampilan audit">
        <Button aria-pressed={!filters.byRecord} variant={!filters.byRecord ? "default" : "outline"} onClick={() => update({ byRecord: false })}>
          Semua audit
        </Button>
        <Button aria-pressed={filters.byRecord} variant={filters.byRecord ? "default" : "outline"} disabled={!validRecord} onClick={() => update({ byRecord: true })}>
          Audit per record
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="audit-table">Tabel (nama persis)</Label>
          <Input id="audit-table" value={filters.tabel} onChange={(event) => update({ tabel: event.target.value })} placeholder="pengadaan" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-record">ID record</Label>
          <Input id="audit-record" value={filters.recordId} onChange={(event) => update({ recordId: event.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-action">Aksi (cocok persis, abaikan kapital)</Label>
          <Input id="audit-action" value={filters.aksi} onChange={(event) => update({ aksi: event.target.value })} placeholder="create / update / delete" />
        </div>
      </div>
      <Button variant="outline" onClick={() => setFilters({ ...initial, tabel: "", recordId: "", aksi: "", query: "", page: 1, byRecord: false })}>
        Reset filter
      </Button>
      <p className="text-sm text-muted-foreground">
        {filters.byRecord ? "Audit per record: semua log record dimuat; pencarian, aksi, dan paginasi diproses lokal." : "Daftar audit: filter dan paginasi diproses server. Akses ADMIN / PIMPINAN."}
      </p>
      {user.isPending ? (
        <LoadingState />
      ) : user.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(user.error)}{" "}
            <Button variant="link" onClick={() => void user.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : !allowed ? (
        <Alert>
          <AlertDescription>{!canAudit ? "Audit log hanya untuk ADMIN / PIMPINAN, termasuk audit per record." : "Isi tabel dan ID record untuk melihat audit."}</AlertDescription>
        </Alert>
      ) : query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(query.error)}{" "}
            <Button variant="link" onClick={() => void query.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          columns={[
            { key: "createdAt", header: "Waktu", render: (row: AuditRecord) => new Date(row.createdAt).toLocaleString("id-ID") },
            {
              key: "pelaku",
              header: "Pengguna",
              render: (row: AuditRecord) => (
                <div>
                  {row.dilakukanOlehUser?.nama ?? row.dilakukanOleh ?? "Sistem / tidak tercatat"}
                  <div className="text-xs text-muted-foreground">{row.dilakukanOlehUser?.email}</div>
                </div>
              ),
            },
            { key: "aksi", header: "Aksi", render: (row: AuditRecord) => row.aksi },
            { key: "tabel", header: "Tabel", render: (row: AuditRecord) => row.tabel },
            {
              key: "recordId",
              header: "Record",
              render: (row: AuditRecord) => (
                <Link className="underline break-all" href={recordUrl(row.tabel, row.recordId)}>
                  {row.recordId}
                </Link>
              ),
            },
            {
              key: "detail",
              header: "Perubahan",
              render: (row: AuditRecord) => (
                <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                  Lihat sebelum / sesudah
                </Button>
              ),
            },
          ]}
          rows={rows}
          rowKey={(row) => row.id}
          emptyMessage="Belum ada audit log."
          searchPlaceholder="Cari tabel, aksi, atau ID record…"
          searchValue={filters.query}
          onSearchChange={(value) => update({ query: value })}
          remoteSearch
          pagination={{
            page: filters.byRecord ? page : filters.page,
            pageSize: filters.limit,
            total,
            totalPages,
            onPageChange: (value) => setFilters((current) => ({ ...current, page: value })),
            onPageSizeChange: (value) => update({ limit: value }),
          }}
        />
      )}
      <Modal
        open={allowed && Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detail perubahan audit"
        size="md"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Tutup
          </Button>
        }
      >
        {selected && (
          <div className="space-y-4">
            <p className="break-all">
              {selected.tabel} / {selected.recordId} / {selected.aksi}
            </p>
            {(["dataSebelum", "dataSesudah"] as const).map((key) => (
              <div key={key}>
                <h3 className="font-semibold">{key === "dataSebelum" ? "Data sebelum" : "Data sesudah"}</h3>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{selected[key] == null ? "Tidak tercatat." : JSON.stringify(selected[key], null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
}

function AuditParams() {
  const params = useSearchParams();
  const tabel = params?.get("tabel") ?? "";
  const recordId = params?.get("recordId") ?? "";
  return (
    <AuditView key={params?.toString() ?? ""} initial={{ tabel, recordId, aksi: params?.get("aksi") ?? "", query: params?.get("query") ?? "", page: 1, limit: 10, byRecord: params?.get("mode") === "record" || Boolean(tabel && recordId) }} />
  );
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuditParams />
    </Suspense>
  );
}
