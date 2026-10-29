"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal, ModalSection } from "@/components/modal/Modal";
import { DataTable } from "@/components/table/DataTable";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { entityText, dateText } from "@/components/procurement/EntityListPage";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";

type CargoPlan = {
  modelPelaksanaan?: string;
  pihakImportir?: string;
  namaImportir?: string;
  jenisKargo?: string;
  spesifikasiMutu?: unknown;
  volumeMin?: number | string;
  volumeMax?: number | string;
  satuan?: string;
  titikSerah?: string;
  estimasiMulai?: string;
  estimasiSelesai?: string;
  penerimaPasokan?: string;
  kesiapanPenerima?: unknown;
  analisisPasar?: unknown;
  dasarPemilihan?: string;
  strategiPengiriman?: string;
  strategiPembiayaan?: string;
};
type Proc = {
  id: string;
  nomorSurat: string;
  judul: string;
  deskripsi?: string;
  metode: string;
  prioritas: string;
  status: string;
  tanggalPengajuan?: string;
  tanggalDeadline?: string;
  unitKerja?: string;
  rencanaTransaksi?:
    | (CargoPlan & {
        id?: string;
        nomor?: string;
        judul?: string;
        deskripsi?: string;
        modelPelaksanaan?: string;
        jenisTransaksi?: string;
        metodeSeleksi?: string;
        analisisPasar?: unknown;
        dasarPemilihan?: string;
        strategiPengiriman?: string;
        strategiPembiayaan?: string;
        prioritas?: string;
        status?: string;
        createdAt?: string;
        updatedAt?: string;
      })
    | null;
  perencanaan?: CargoPlan | null;
  strategi?: { jenisTransaksi?: string; metodeSeleksi?: string; analisisPasar?: unknown; dasarPemilihan?: string; strategiPengiriman?: string; strategiPembiayaan?: string } | null;
  diajukanOlehUser?: { nama?: string; email?: string; unitKerja?: string } | null;
  approvalSteps?: { id: string; urutan: number; namaLangkah: string; status: string; catatan?: string | null; tanggalKeputusan?: string | null; penanggungJawabUser?: { nama?: string } | null }[];
  items?: unknown[];
  createdAt?: string;
  updatedAt?: string;
  totalEstimasi?: number | string | null;
  dokumen?: { id?: string; nama?: string; namaFile?: string; jenis?: string; url?: string; createdAt?: string }[];
  notifikasi?: { id?: string; judul?: string; pesan?: string; tanggalKirim?: string; status?: string }[];
};
const unwrap = (result: any) => result?.data?.data ?? result?.data ?? result;
const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    if (Array.isArray(value))
      return (
        value
          .map(displayValue)
          .filter((item) => item !== "—")
          .join("\n") || "—"
      );
    return (
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => `${key}: ${displayValue(item)}`)
        .join("\n") || "—"
    );
  }
  return String(value);
};
function DetailField({ label, value, long = false }: { label: string; value: unknown; long?: boolean }) {
  const text = displayValue(value);
  return (
    <div className={long ? "min-w-0 border-t border-border/60 pt-3 first:border-0 first:pt-0" : "min-w-0 border-b border-border/60 pb-2.5 last:border-0 last:pb-0"}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={long ? "mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-foreground" : "mt-1 whitespace-pre-wrap break-words text-sm font-medium text-foreground"}>{text}</dd>
    </div>
  );
}
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card px-4 py-4 sm:px-5">
      <header className="mb-3 border-b pb-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
      </header>
      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export default function PengadaanPage() {
  const [rows, setRows] = useState<Proc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<Proc | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [filter, setFilter] = useState("");
  const refresh = useCallback(async () => {
    setBrowserToken();
    try {
      const result: any = await browserApi.pengadaan.pengadaanGetControllerFindAll({ page, limit: 20, status: (filter || undefined) as any }, { format: "json" });
      const body = result?.data ?? result;
      const data = body?.data ?? body;
      setRows(Array.isArray(data) ? data : (data?.items ?? []));
      setTotalPages(Number(body?.pagination?.total_pages ?? 1));
      setTotalRows(Number(body?.pagination?.total ?? body?.pagination?.total_items ?? data?.items?.length ?? 0));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }, [filter, page]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function open(id: string) {
    try {
      setBrowserToken();
      const result = await apiData(browserApi.pengadaan.pengadaanGetControllerFindOne(id, { format: "json" }) as Promise<{ data: unknown }>);
      setDetail(unwrap(result));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }
  async function remove(row: Proc) {
    if (!window.confirm(`Hapus pengadaan ${row.nomorSurat}?`)) return;
    setBusy(true);
    try {
      setBrowserToken();
      await browserApi.pengadaan.pengadaanDeleteControllerRemove(row.id, { format: "json" });
      setNotice("Pengadaan dihapus.");
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function submit(row: Proc) {
    setBusy(true);
    setError("");
    try {
      setBrowserToken();
      await browserApi.approval.approvalActionControllerSubmit(row.id, { format: "json" });
      setNotice("Pengadaan diajukan untuk approval.");
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Pengadaan Minyak</h1>
        <p className="text-muted-foreground">Pantau rencana kargo, approval, dan siklus transaksi minyak.</p>
      </header>
      {error && (
        <p role="alert" className="rounded border border-destructive p-3 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded border border-emerald-600 p-3 text-sm">
          {notice}
        </p>
      )}
      <DataTable
        columns={[
          {
            key: "nomorSurat",
            header: "Nomor / judul",
            render: (r) => (
              <>
                <strong>{r.nomorSurat}</strong>
                <div>{r.judul}</div>
                {r.rencanaTransaksi && <div className="text-xs text-muted-foreground">Sumber rencana: {r.rencanaTransaksi.nomor}</div>}
              </>
            ),
          },
          { key: "metode", header: "Metode / prioritas", render: (r) => `${entityText(r.metode)} / ${entityText(r.prioritas)}` },
          {
            key: "tanggalPengajuan",
            header: "Tanggal",
            render: (r) => (
              <>
                Pengajuan {dateText(r.tanggalPengajuan)}
                <div>Deadline {dateText(r.tanggalDeadline)}</div>
              </>
            ),
          },
          {
            key: "kargo",
            header: "Kargo / volume",
            render: (r) => {
              const plan = r.perencanaan;
              return plan ? `${plan.jenisKargo ?? "—"} · ${plan.volumeMin ?? "—"}–${plan.volumeMax ?? "—"} ${plan.satuan ?? ""}` : "Ringkasan kargo belum tersedia";
            },
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status === "selesai" || r.status === "disetujui" ? "ok" : r.status === "ditolak" || r.status === "dibatalkan" ? "danger" : "warn"}>{entityText(r.status)}</StatusBadge>,
          },
          {
            key: "actions",
            header: "Aksi",
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void open(r.id)}>
                  Detail
                </Button>
                <Button size="sm" render={<Link href={`/dashboard/pengadaan/${r.id}/siklus`} />}>
                  Siklus
                </Button>
                {["draft", "revisi"].includes(r.status) && (
                  <Button size="sm" disabled={busy} onClick={() => void submit(r)}>
                    Ajukan approval
                  </Button>
                )}
                {["draft", "revisi", "ditolak"].includes(r.status) && (
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(r)}>
                    Hapus
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        rows={rows}
        rowKey={(row) => row.id}
        hideSearch
        pageSize={20}
        rowsPerPageOptions={[20]}
        emptyMessage="Belum ada pengadaan. Buat pengadaan melalui Rencana Transaksi."
        filters={[{ field: "status", label: "Status", options: ["draft", "diajukan", "dalam_review", "disetujui", "ditolak", "revisi", "sedang_proses", "selesai", "dibatalkan"].map((value) => ({ value, label: entityText(value) })) }]}
        filterValues={{ status: filter || "__all" }}
        onFilterChange={(field, value) => {
          if (field === "status") {
            setPage(1);
            setFilter(value === "__all" ? "" : value);
          }
        }}
        remoteSearch
        pagination={{ page, pageSize: 20, total: totalRows, totalPages, onPageChange: setPage, onPageSizeChange: () => setPage(1) }}
      />
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detail pengadaan"
        description="Informasi pengadaan, sumber perencanaan, kargo, strategi, dan riwayat persetujuan."
        size="xl"
        contentClassName="max-h-[92dvh]"
        bodyClassName="space-y-4 bg-muted/10"
      >
        {detail && (
          <div className="mx-auto w-full max-w-5xl space-y-4">
            <section className="rounded-xl border bg-background p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{detail.nomorSurat}</p>
                  <h3 className="mt-1 break-words text-lg font-semibold tracking-tight">{detail.judul}</h3>
                </div>
                <StatusBadge status={detail.status === "selesai" || detail.status === "disetujui" ? "ok" : detail.status === "ditolak" || detail.status === "dibatalkan" ? "danger" : "warn"}>{entityText(detail.status)}</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Metode pengadaan</p><p className="mt-1 text-sm font-medium">{entityText(detail.metode)}</p></div>
                <div><p className="text-xs text-muted-foreground">Prioritas</p><p className="mt-1 text-sm font-medium">{entityText(detail.prioritas)}</p></div>
                <div><p className="text-xs text-muted-foreground">Total estimasi</p><p className="mt-1 text-sm font-medium">{displayValue(detail.totalEstimasi)}</p></div>
              </div>
            </section>
            <div className="space-y-4">
              <DetailSection title="Informasi pengadaan">
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <DetailField label="Diajukan oleh" value={detail.diajukanOlehUser?.nama} />
                  <DetailField label="Email pengaju" value={detail.diajukanOlehUser?.email} />
                  <DetailField label="Unit kerja" value={detail.unitKerja ?? detail.diajukanOlehUser?.unitKerja} />
                  <DetailField label="Tanggal pengajuan" value={detail.tanggalPengajuan ? dateText(detail.tanggalPengajuan) : undefined} />
                  <DetailField label="Deadline" value={dateText(detail.tanggalDeadline)} />
                  <DetailField label="Diperbarui" value={detail.updatedAt ? dateText(detail.updatedAt) : undefined} />
                </div>
                <div className="mt-4">
                  <DetailField label="Deskripsi" value={detail.deskripsi} long />
                </div>
              </DetailSection>
              {detail.rencanaTransaksi && (
                <>
                  <DetailSection title="Sumber e-Planning">
                    <DetailField label="Nomor rencana" value={detail.rencanaTransaksi.nomor} />
                    <DetailField label="Judul rencana" value={detail.rencanaTransaksi.judul} />
                    <DetailField label="Status rencana" value={detail.rencanaTransaksi.status ? entityText(detail.rencanaTransaksi.status) : undefined} />
                    <div className="mt-1">
                      <DetailField label="Deskripsi rencana" value={detail.rencanaTransaksi.deskripsi} long />
                    </div>
                  </DetailSection>
                </>
              )}
              <DetailSection title="Rincian kargo">
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <DetailField label="Jenis kargo" value={detail.perencanaan?.jenisKargo ?? detail.rencanaTransaksi?.jenisKargo} />
                  <DetailField
                    label="Model pelaksanaan"
                    value={detail.perencanaan?.modelPelaksanaan ? entityText(detail.perencanaan.modelPelaksanaan) : detail.rencanaTransaksi?.modelPelaksanaan ? entityText(detail.rencanaTransaksi.modelPelaksanaan) : undefined}
                  />
                  <DetailField
                    label="Pihak importir"
                    value={detail.perencanaan?.pihakImportir ? entityText(detail.perencanaan.pihakImportir) : detail.rencanaTransaksi?.pihakImportir ? entityText(detail.rencanaTransaksi.pihakImportir) : undefined}
                  />
                  <DetailField label="Nama importir" value={detail.perencanaan?.namaImportir ?? detail.rencanaTransaksi?.namaImportir} />
                  <DetailField label="Volume minimum" value={detail.perencanaan?.volumeMin ?? detail.rencanaTransaksi?.volumeMin} />
                  <DetailField label="Volume maksimum" value={detail.perencanaan?.volumeMax ?? detail.rencanaTransaksi?.volumeMax} />
                  <DetailField label="Satuan" value={detail.perencanaan?.satuan ?? detail.rencanaTransaksi?.satuan} />
                  <DetailField label="Titik serah" value={detail.perencanaan?.titikSerah ?? detail.rencanaTransaksi?.titikSerah} />
                  <DetailField label="Penerima pasokan" value={detail.perencanaan?.penerimaPasokan ?? detail.rencanaTransaksi?.penerimaPasokan} />
                  <DetailField
                    label="Estimasi mulai"
                    value={(detail.perencanaan?.estimasiMulai ?? detail.rencanaTransaksi?.estimasiMulai) ? dateText((detail.perencanaan?.estimasiMulai ?? detail.rencanaTransaksi?.estimasiMulai)!) : undefined}
                  />
                  <DetailField
                    label="Estimasi selesai"
                    value={(detail.perencanaan?.estimasiSelesai ?? detail.rencanaTransaksi?.estimasiSelesai) ? dateText((detail.perencanaan?.estimasiSelesai ?? detail.rencanaTransaksi?.estimasiSelesai)!) : undefined}
                  />
                </div>
                <div className="mt-4 border-t pt-3">
                  <DetailField label="Spesifikasi mutu" value={detail.perencanaan?.spesifikasiMutu ?? detail.rencanaTransaksi?.spesifikasiMutu} long />
                </div>
              </DetailSection>
              <DetailSection title="Strategi dan analisis">
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <DetailField
                    label="Jenis transaksi"
                    value={detail.strategi?.jenisTransaksi ? entityText(detail.strategi.jenisTransaksi) : detail.rencanaTransaksi?.jenisTransaksi ? entityText(detail.rencanaTransaksi.jenisTransaksi) : undefined}
                  />
                  <DetailField
                    label="Metode seleksi"
                    value={detail.strategi?.metodeSeleksi ? entityText(detail.strategi.metodeSeleksi) : detail.rencanaTransaksi?.metodeSeleksi ? entityText(detail.rencanaTransaksi.metodeSeleksi) : undefined}
                  />
                </div>
                <div className="mt-4 space-y-3 border-t pt-3">
                  <DetailField label="Dasar pemilihan" value={detail.strategi?.dasarPemilihan ?? detail.rencanaTransaksi?.dasarPemilihan} long />
                  <DetailField label="Strategi pengiriman" value={detail.strategi?.strategiPengiriman ?? detail.rencanaTransaksi?.strategiPengiriman} long />
                  <DetailField label="Strategi pembiayaan" value={detail.strategi?.strategiPembiayaan ?? detail.rencanaTransaksi?.strategiPembiayaan} long />
                  <DetailField label="Kesiapan penerima" value={detail.perencanaan?.kesiapanPenerima ?? detail.rencanaTransaksi?.kesiapanPenerima} long />
                  <DetailField label="Analisis pasar" value={detail.strategi?.analisisPasar ?? detail.rencanaTransaksi?.analisisPasar} long />
                </div>
              </DetailSection>
            </div>
            <ModalSection title="Riwayat persetujuan">
              {detail.approvalSteps?.length ? (
                <ol className="divide-y divide-border/70">
                  {[...detail.approvalSteps]
                    .sort((a, b) => a.urutan - b.urutan)
                    .map((step) => (
                      <li key={step.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                        <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${step.status === "disetujui" ? "bg-emerald-100 text-emerald-700" : step.status === "ditolak" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>{step.urutan}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{step.namaLangkah}</p>
                            <StatusBadge status={step.status === "disetujui" ? "ok" : step.status === "ditolak" ? "danger" : "warn"}>{entityText(step.status)}</StatusBadge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {step.penanggungJawabUser?.nama ?? "Belum diproses"}
                            {step.tanggalKeputusan ? ` · ${dateText(step.tanggalKeputusan)}` : ""}
                          </p>
                          {step.catatan && <p className="mt-2 whitespace-pre-wrap text-sm leading-5">{step.catatan}</p>}
                        </div>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">Belum ada riwayat persetujuan untuk pengadaan ini.</p>
              )}
            </ModalSection>
            {detail.items?.length ? (
              <DetailSection title="Item pengadaan">
                {detail.items.map((item, index) => (
                  <DetailField key={index} label={`Item ${index + 1}`} value={item} />
                ))}
              </DetailSection>
            ) : null}
          </div>
        )}
      </Modal>
    </main>
  );
}
