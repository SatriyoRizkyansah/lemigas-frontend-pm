"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCurrentUser } from "@/lib/api/hooks";
import { DataTable } from "@/components/table/DataTable";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/loading/EmptyState";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { ContentType } from "@/lib/api/generated/api-generated";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getApiErrorMessage } from "@/lib/api/errors";
type RecordData = Record<string, any>;
const auditTables: Record<string, string> = {
  perencanaan: "perencanaan_kebutuhan",
  strategi: "strategi_transaksi",
  rfq: "rfq",
  penawaran: "penawaran_vendor",
  verifikasi: "verifikasi_vendor",
  negosiasi: "negosiasi_transaksi",
  memorandum: "memorandum_keputusan",
  kontrak: "kontrak",
  adendum: "adendum_kontrak",
  pengiriman: "pengiriman_kargo",
  pemeriksaan: "pemeriksaan_kargo",
  penerimaan: "penerimaan_kargo",
  penyimpanan: "penyimpanan_kargo",
  dokumenOperasional: "dokumen_operasional",
  risiko: "risiko_transaksi",
  tagihan: "tagihan",
  pembayaran: "pembayaran",
  rekonsiliasi: "rekonsiliasi",
  klaim: "klaim_transaksi",
  laporan: "laporan_transaksi",
};
const auditUrl = (tabel: string, recordId: string) => `/dashboard/audit-log?${new URLSearchParams({ tabel, recordId, mode: "record" })}`;
const sections: Record<string, Array<[string, string]>> = {
  perencanaan: [
    ["perencanaan", "Kebutuhan transaksi"],
    ["strategi", "Strategi sourcing"],
  ],
  pemilihan_penyedia: [["rfq", "RFQ"]],
  penawaran_vendor: [["penawaran", "Penawaran vendor"]],
  verifikasi_evaluasi: [
    ["penawaran", "Penawaran vendor"],
    ["verifikasi", "Verifikasi vendor"],
  ],
  klarifikasi_negosiasi: [["negosiasi", "Hasil negosiasi"]],
  rekomendasi_pemenang: [],
  verifikasi_vendor: [["verifikasi", "Verifikasi vendor"]],
  permintaan_penawaran: [
    ["rfq", "RFQ"],
    ["penawaran", "Penawaran vendor"],
  ],
  uji_kewajaran_negosiasi: [["negosiasi", "Hasil negosiasi"]],
  memorandum_keputusan: [["memorandum", "Memorandum"]],
  sourcing: [
    ["rfq", "RFQ"],
    ["penawaran", "Penawaran vendor"],
  ],
  evaluasi_negosiasi: [
    ["verifikasi", "Verifikasi vendor"],
    ["negosiasi", "Hasil negosiasi"],
  ],
  approval: [
    ["memorandum", "Memorandum"],
    ["approvalSteps", "Riwayat approval"],
  ],
  kontrak: [
    ["kontrak", "Kontrak"],
    ["adendum", "Adendum kontrak"],
  ],
  delivery: [
    ["pengiriman", "Pengiriman"],
    ["pemeriksaan", "Pemeriksaan"],
    ["penerimaan", "Penerimaan"],
    ["penyimpanan", "Penyimpanan"],
    ["dokumenOperasional", "Dokumen operasional"],
    ["risiko", "Risiko dan tindak lanjut"],
  ],
  settlement: [
    ["tagihan", "Tagihan"],
    ["pembayaran", "Pembayaran"],
    ["rekonsiliasi", "Rekonsiliasi"],
    ["klaim", "Klaim"],
  ],
  selesai: [["laporan", "Laporan transaksi"]],
};
const list = (value: any): RecordData[] => (Array.isArray(value) ? value : value ? [value] : []);
const text = (value: any): string =>
  value == null || value === ""
    ? "—"
    : typeof value === "object"
      ? Object.entries(value)
          .map(([key, item]) => `${key}: ${String(item ?? "—")}`)
          .join(" · ")
      : String(value);
const date = (value: any) => (value ? new Date(value).toLocaleString("id-ID") : "—");
const fieldLabels: Record<string, string> = {
  jenisTransaksi: "Jenis transaksi",
  metodeSeleksi: "Metode seleksi",
  modelPelaksanaan: "Model pelaksanaan",
  jenisKargo: "Jenis kargo",
  nomorPenugasan: "Nomor penugasan",
  spesifikasiMutu: "Spesifikasi mutu",
  volumeMin: "Volume minimum",
  volumeMax: "Volume maksimum",
  satuan: "Satuan",
  titikSerah: "Titik serah",
  estimasiMulai: "Estimasi mulai",
  estimasiSelesai: "Estimasi selesai",
  penerimaPasokan: "Penerima pasokan",
  kesiapanPenerima: "Kesiapan penerima",
  analisisPasar: "Analisis pasar",
  dasarPemilihan: "Dasar pemilihan",
  strategiPengiriman: "Strategi pengiriman",
  strategiPembiayaan: "Strategi pembiayaan",
  status: "Status",
  createdAt: "Dicatat pada",
  updatedAt: "Diperbarui pada",
};
const hiddenFields = new Set(["id", "pengadaanId", "createdBy", "updatedBy", "disetujuiOleh"]);
const isIdField = (key: string) => hiddenFields.has(key) || /(?:^id$|id$|Id$)/.test(key);
function DetailValue({ value }: { value: any }) {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) return <span className="text-muted-foreground">Data terkait</span>;
  if (Array.isArray(value))
    return value.length ? (
      <ul className="list-disc space-y-1 pl-5">
        {value.map((item, index) => (
          <li key={index}>
            <DetailValue value={item} />
          </li>
        ))}
      </ul>
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([key]) => !isIdField(key));
    if (!entries.length) return <span className="text-muted-foreground">—</span>;
    if (entries.length === 1) return <DetailValue value={entries[0][1]} />;
    const titleEntry = entries.find(([key]) => ["nama", "name", "nomor", "kode"].includes(key.toLowerCase()));
    const remainingEntries = entries.filter(([key]) => key !== titleEntry?.[0]);
    return (
      <div className="space-y-2">
        {titleEntry ? (
          <h4 className="mb-2 border-b border-border/70 pb-2 break-words font-semibold text-foreground">
            <DetailValue value={titleEntry[1]} />
          </h4>
        ) : null}
        <dl className="divide-y divide-border/70">
          {remainingEntries.map(([key, item]) => (
            <div key={key} className="grid min-w-0 gap-1 py-2 first:pt-0 last:pb-0 sm:grid-cols-[minmax(9rem,0.35fr)_minmax(0,1fr)] sm:gap-4">
              <dt className="text-xs font-medium text-muted-foreground">{fieldLabels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</dt>
              <dd className="min-w-0 break-words text-sm font-normal text-foreground">
                <DetailValue value={item} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return <>{date(value)}</>;
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

export function LifecycleRecords({ stage, active, pengadaanId, detail }: { stage: string; active: boolean; pengadaanId: string; detail: RecordData }) {
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [jenisDraft, setJenisDraft] = useState<Record<string, string>>({});
  const [evaluating, setEvaluating] = useState<RecordData | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [evaluation, setEvaluation] = useState({ administrasi: false, teknis: false, komersial: false, skor: "", peringkat: "", alasan: "", catatanEvaluasi: "" });
  const [recommendation, setRecommendation] = useState("");
  const user = useCurrentUser();
  const canManageRfq = user.isSuccess && !user.isRefetchError && ["admin", "operator"].includes(user.data.role.toLowerCase());
  const [rfqActionError, setRfqActionError] = useState("");
  const rfqAction = use_mutation<unknown, Error, { rfqId: string; action: "tutup" | "buka-kembali" }>({
    tag: "siklusTransaksiKomoditas",
    method: "rfqLifecycleAction",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("lifecycleEvidence")],
    mutationFn: async ({ rfqId, action }) => {
      setBrowserToken();
      return apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/rfq/${encodeURIComponent(rfqId)}/${action}`,
          method: "POST",
          body: { alasan: action === "tutup" ? "Ditutup dari detail RFQ" : "Dibuka kembali dari detail RFQ" },
          secure: true,
          type: ContentType.Json,
          format: "json",
        }) as Promise<{ data: unknown }>,
      );
    },
    onError: (error) => setRfqActionError(getApiErrorMessage(error)),
    onSuccess: () => setRfqActionError(""),
  });
  const updateContractType = use_mutation<unknown, Error, { id: string; jenis: string }>({
    tag: "siklusTransaksiKomoditas",
    method: "updateContractType",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("lifecycleEvidence")],
    mutationFn: async ({ id, jenis }) => {
      setBrowserToken();
      return apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/kontrak/${encodeURIComponent(id)}/jenis`,
          method: "PUT",
          body: { jenis },
          secure: true,
          type: ContentType.Json,
          format: "json",
        }) as Promise<{ data: unknown }>,
      );
    },
  });
  const canAudit = user.isSuccess && !user.isRefetchError && ["admin", "pimpinan"].includes(user.data.role.toLowerCase());
  const canManageSelection = user.isSuccess && !user.isRefetchError && ["admin", "operator", "verifikator"].includes(user.data.role.toLowerCase());
  const selectionMutation = use_mutation<unknown, Error, { path: string; method: "PUT" | "POST"; body: RecordData }>({
    tag: "siklusTransaksiKomoditas",
    method: "pemilihanPenyedia",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("lifecycleEvidence"), apiQueryKeys.resource("approval")],
    mutationFn: async ({ path, method, body }) => {
      setBrowserToken();
      return apiData(browserApi.request({ path, method, body, secure: true, type: ContentType.Json, format: "json" }) as Promise<{ data: unknown }>);
    },
  });
  const selection = detail.pemilihanPenyedia as RecordData | undefined;
  const selectionParticipants = list(selection?.peserta);
  const derived: RecordData = {
    ...detail,
    negosiasi: list(detail.penawaran).flatMap((offer) => list(offer.negosiasi).map((row) => ({ ...row, vendor: offer.vendor, penawaranId: offer.id }))),
    adendum: list(detail.kontrak).flatMap((contract) => list(contract.adendum).map((row) => ({ ...row, nomorKontrak: contract.nomor }))),
    pemeriksaan: list(detail.pengiriman).flatMap((shipment) => list(shipment.pemeriksaan).map((row) => ({ ...row, nomorBillOfLading: shipment.nomorBillOfLading, pengirimanId: shipment.id }))),
  };
  const currentSelected = selected?.id
    ? (Object.values(derived)
        .flatMap((value) => list(value))
        .find((row) => row.id === selected.id) ?? selected)
    : selected;
  const comparison: RecordData[] = list(detail.penawaran).map((offer) => {
    const latest = [...list(offer.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
    return {
      ...offer,
      vendorName: offer.vendor?.nama ?? offer.vendorId,
      verification:
        list(detail.verifikasi)
          .filter((row) => row.vendorId === offer.vendorId)
          .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0]?.hasil ?? "Belum diverifikasi",
      putaran: latest?.putaran,
      totalBiayaPerolehan: latest?.totalBiayaPerolehan,
      hasil: latest?.hasil,
    };
  });
  return (
    <div className="space-y-6">
      {canAudit && detail.id && (
        <Link className="text-sm underline" href={auditUrl("pengadaan", detail.id)}>
          Audit record pengadaan
        </Link>
      )}
      {rfqActionError ? (
        <Alert variant="destructive">
          <AlertDescription>{rfqActionError}</AlertDescription>
        </Alert>
      ) : null}
      {selection ? (
        <details className="group rounded-lg border px-4" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
            Pemilihan penyedia
            <span className="text-xs font-normal text-muted-foreground">{String(selection.status ?? "draft").replaceAll("_", " ")}</span>
          </summary>
          <div className="space-y-3 border-t py-4">
            {selection.justifikasiPenunjukan ? (
              <p className="rounded-md bg-muted/50 p-3 text-sm">
                <strong>Justifikasi:</strong> {String(selection.justifikasiPenunjukan)}
              </p>
            ) : null}
            <DataTable
              rows={selectionParticipants}
              rowKey={(row) => row.id}
              emptyMessage="Belum ada peserta pemilihan."
              columns={[
                { key: "vendor", header: "Vendor", render: (row) => text(row.vendor?.nama ?? row.vendorId) },
                { key: "status", header: "Status", render: (row) => text(row.status) },
                { key: "skor", header: "Skor", render: (row) => text(row.skor) },
                { key: "peringkat", header: "Peringkat", render: (row) => text(row.peringkat) },
                { key: "kelulusan", header: "Kelulusan", render: (row) => `${row.lulusAdministrasi ? "A" : "-"} / ${row.lulusTeknis ? "T" : "-"} / ${row.lulusKomersial ? "K" : "-"}` },
                {
                  key: "aksi",
                  header: "Aksi",
                  render: (row) => (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!active || !canManageSelection || selectionMutation.isPending}
                      onClick={() => {
                        setEvaluation({
                          administrasi: Boolean(row.lulusAdministrasi),
                          teknis: Boolean(row.lulusTeknis),
                          komersial: Boolean(row.lulusKomersial),
                          skor: row.skor == null ? "" : String(row.skor),
                          peringkat: row.peringkat == null ? "" : String(row.peringkat),
                          alasan: String(row.alasan ?? ""),
                          catatanEvaluasi: String(row.catatanEvaluasi ?? ""),
                        });
                        setEvaluating(row);
                      }}
                    >
                      Nilai
                    </Button>
                  ),
                },
              ]}
            />
            {canManageSelection && active && stage === "rekomendasi_pemenang" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
                <p className="text-sm text-muted-foreground">Pilih peserta lulus sebagai pemenang rekomendasi sebelum memorandum.</p>
                <Button size="sm" disabled={selectionMutation.isPending || !selectionParticipants.some((row) => row.status === "lulus")} onClick={() => setRecommending(true)}>
                  Rekomendasikan pemenang
                </Button>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
      {(stage === "pemilihan_penyedia" ||
        stage === "permintaan_penawaran" ||
        stage === "verifikasi_evaluasi" ||
        stage === "klarifikasi_negosiasi" ||
        stage === "uji_kewajaran_negosiasi" ||
        stage === "sourcing" ||
        stage === "evaluasi_negosiasi") && (
        <details className="group rounded-lg border px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
            Perbandingan penawaran
            <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t py-4">
            <p className="text-xs text-muted-foreground">Biaya menggunakan mata uang masing-masing; tanpa konversi kurs atau peringkat otomatis. Negosiasi memakai putaran tertinggi.</p>
            <DataTable
              rows={comparison}
              rowKey={(row) => row.id}
              emptyMessage="Belum ada penawaran."
              columns={[
                { key: "vendorName", header: "Vendor", render: (row) => text(row.vendorName) },
                { key: "nomorRfq", header: "RFQ", render: (row) => text(row.nomorRfq) },
                { key: "hargaAcuan", header: "Harga acuan", render: (row) => text(row.hargaAcuan) },
                { key: "diferensialHarga", header: "Diferensial", render: (row) => text(row.diferensialHarga) },
                { key: "hargaPenawaran", header: "Penawaran", render: (row) => text(row.hargaPenawaran) },
                { key: "mataUang", header: "Mata uang", render: (row) => text(row.mataUang) },
                { key: "verification", header: "Verifikasi", render: (row) => text(row.verification) },
                { key: "putaran", header: "Putaran", render: (row) => text(row.putaran) },
                { key: "totalBiayaPerolehan", header: "Total biaya perolehan", render: (row) => text(row.totalBiayaPerolehan) },
                { key: "hasil", header: "Hasil negosiasi", render: (row) => text(row.hasil) },
                {
                  key: "detail",
                  header: "Detail",
                  render: (row) => (
                    <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                      Lihat
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </details>
      )}
      {(sections[stage] ?? []).map(([key, title]) => {
        const rows: RecordData[] = list(derived[key]).map((row) => ({
          ...row,
          ringkasan: row.nomor ?? row.nomorRfq ?? row.nomorBast ?? row.namaKapal ?? row.jenisKargo ?? row.kategori ?? row.jenis ?? row.metodeSeleksi ?? row.id,
          pihak: row.vendor?.nama ?? row.penanggungJawabUser?.nama ?? row.nomorKontrak ?? row.vendorId ?? row.dibuatOleh ?? row.diunggahOleh ?? "—",
        }));
        return (
          <details className="group rounded-lg border px-4" key={key}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
              <span>
                {title}
                <span className="ml-2 text-xs font-normal text-muted-foreground">({rows.length})</span>
              </span>
              <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t py-4">
              {rows.length ? (
                <DataTable
                  rows={rows}
                  rowKey={(row, index) => row.id ?? index}
                  columns={[
                    { key: "ringkasan", header: "Record", render: (row) => text(row.ringkasan) },
                    { key: "pihak", header: "Pihak / relasi", render: (row) => text(row.pihak) },
                    { key: "status", header: "Status", render: (row) => text(row.status ?? row.hasil) },
                    ...(key === "rfq"
                      ? [
                          {
                            key: "rfqActions",
                            header: "Aksi RFQ",
                            render: (row: RecordData) => {
                              const action = row.status === "aktif" ? "tutup" : row.status === "selesai" ? "buka-kembali" : null;
                              if (!action || !canManageRfq) return <span className="text-xs text-muted-foreground">—</span>;
                              return (
                                <Button
                                  size="sm"
                                  variant={action === "tutup" ? "outline" : "secondary"}
                                  disabled={rfqAction.isPending || !active}
                                  onClick={() => {
                                    const confirmText = action === "tutup" ? "Tutup RFQ ini? Vendor tidak dapat mengirim penawaran baru." : "Buka kembali RFQ ini? Vendor dapat mengirim penawaran lagi.";
                                    if (window.confirm(confirmText)) rfqAction.mutate({ rfqId: row.id, action });
                                  }}
                                >
                                  {action === "tutup" ? "Tutup RFQ" : "Buka kembali"}
                                </Button>
                              );
                            },
                          },
                        ]
                      : []),
                    ...(key === "kontrak"
                      ? [
                          {
                            key: "jenisKontrak",
                            header: "Jenis kontrak",
                            render: (row: RecordData) => (
                              <div className="flex min-w-56 items-center gap-2">
                                <select
                                  aria-label={`Jenis kontrak ${row.nomor ?? row.id}`}
                                  value={jenisDraft[row.id] ?? row.jenis ?? ""}
                                  onChange={(event) => setJenisDraft((old) => ({ ...old, [row.id]: event.target.value }))}
                                  disabled={!active || updateContractType.isPending || !["admin", "operator"].includes(user.data?.role.toLowerCase() ?? "")}
                                  className="rounded-md border bg-background p-2 text-sm"
                                >
                                  <option value="penyedia">Penyedia</option>
                                  <option value="kerja_sama_penerima_pasokan">PKS penerima pasokan</option>
                                </select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!active || updateContractType.isPending || !["admin", "operator"].includes(user.data?.role.toLowerCase() ?? "") || !jenisDraft[row.id] || jenisDraft[row.id] === row.jenis}
                                  onClick={() =>
                                    updateContractType.mutate(
                                      { id: row.id, jenis: jenisDraft[row.id] },
                                      {
                                        onSuccess: () =>
                                          setJenisDraft((old) => {
                                            const next = { ...old };
                                            delete next[row.id];
                                            return next;
                                          }),
                                      },
                                    )
                                  }
                                >
                                  Simpan jenis
                                </Button>
                              </div>
                            ),
                          },
                        ]
                      : []),
                    ...(key === "kontrak"
                      ? [
                          { key: "tanggalTandaTangan", header: "Tanggal tanda tangan", render: (row: RecordData) => date(row.tanggalTandaTangan) },
                          { key: "mulaiBerlaku", header: "Mulai berlaku", render: (row: RecordData) => date(row.mulaiBerlaku) },
                          { key: "berakhirPada", header: "Berakhir", render: (row: RecordData) => date(row.berakhirPada) },
                        ]
                      : []),
                    { key: "createdAt", header: "Dicatat", render: (row) => date(row.createdAt) },
                    { key: "updatedAt", header: "Diperbarui", render: (row) => date(row.updatedAt ?? row.tanggalKeputusan) },
                    {
                      key: "detail",
                      header: "Detail",
                      render: (row) => (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                            Lihat
                          </Button>
                          {canAudit && row.id && auditTables[key] && (
                            <Link className="text-sm underline" href={auditUrl(auditTables[key], row.id)}>
                              Audit record
                            </Link>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
              ) : (
                <EmptyState title={`Belum ada ${title.toLowerCase()}`} description="Record akan tampil setelah dicatat." />
              )}
            </div>
          </details>
        );
      })}
      <Modal
        open={Boolean(evaluating)}
        onClose={() => !selectionMutation.isPending && setEvaluating(null)}
        title="Evaluasi peserta"
        description={evaluating ? `Nilai ${String(evaluating.vendor?.nama ?? evaluating.vendorId)}` : undefined}
        size="md"
        footer={
          <>
            <Button variant="outline" disabled={selectionMutation.isPending} onClick={() => setEvaluating(null)}>
              Batal
            </Button>
            <Button
              disabled={selectionMutation.isPending}
              onClick={() => {
                if (!evaluating) return;
                selectionMutation.mutate(
                  {
                    path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/pemilihan-penyedia/peserta/${encodeURIComponent(String(evaluating.id))}`,
                    method: "PUT",
                    body: {
                      lulusAdministrasi: evaluation.administrasi,
                      lulusTeknis: evaluation.teknis,
                      lulusKomersial: evaluation.komersial,
                      ...(evaluation.skor ? { skor: Number(evaluation.skor) } : {}),
                      ...(evaluation.peringkat ? { peringkat: Number(evaluation.peringkat) } : {}),
                      ...(evaluation.alasan.trim() ? { alasan: evaluation.alasan.trim() } : {}),
                      ...(evaluation.catatanEvaluasi.trim() ? { catatanEvaluasi: evaluation.catatanEvaluasi.trim() } : {}),
                    },
                  },
                  { onSuccess: () => setEvaluating(null), onError: (error) => setRfqActionError(getApiErrorMessage(error)) },
                );
              }}
            >
              {selectionMutation.isPending ? "Menyimpan…" : "Simpan evaluasi"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Peserta lulus bila administrasi, teknis, dan komersial seluruhnya memenuhi.</p>
          {(
            [
              ["administrasi", "Lulus administrasi"],
              ["teknis", "Lulus teknis"],
              ["komersial", "Lulus komersial"],
            ] as const
          ).map(([key, label]) => (
            <Label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={evaluation[key]} onChange={(event) => setEvaluation((value) => ({ ...value, [key]: event.target.checked }))} />
              {label}
            </Label>
          ))}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="selection-score">Skor</Label>
              <Input id="selection-score" type="number" value={evaluation.skor} onChange={(event) => setEvaluation((value) => ({ ...value, skor: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="selection-rank">Peringkat</Label>
              <Input id="selection-rank" type="number" min="1" value={evaluation.peringkat} onChange={(event) => setEvaluation((value) => ({ ...value, peringkat: event.target.value }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="selection-reason">Alasan evaluasi</Label>
            <Input id="selection-reason" value={evaluation.alasan} onChange={(event) => setEvaluation((value) => ({ ...value, alasan: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="selection-notes">Catatan evaluasi</Label>
            <Input id="selection-notes" value={evaluation.catatanEvaluasi} onChange={(event) => setEvaluation((value) => ({ ...value, catatanEvaluasi: event.target.value }))} />
          </div>
        </div>
      </Modal>
      <Modal
        open={recommending}
        onClose={() => !selectionMutation.isPending && setRecommending(false)}
        title="Rekomendasikan pemenang"
        description="Hanya peserta yang lulus evaluasi dapat direkomendasikan."
        size="md"
        footer={
          <Button variant="outline" disabled={selectionMutation.isPending} onClick={() => setRecommending(false)}>
            Batal
          </Button>
        }
      >
        <div className="space-y-3">
          <Label htmlFor="selection-winner">Vendor pemenang</Label>
          {selectionParticipants
            .filter((row) => row.status === "lulus")
            .map((row) => (
              <Button
                key={row.id}
                className="w-full justify-start"
                variant="outline"
                disabled={selectionMutation.isPending || !recommendation.trim()}
                onClick={() =>
                  selectionMutation.mutate(
                    { path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/pemilihan-penyedia/rekomendasi`, method: "POST", body: { vendorTerpilihId: row.vendorId, rekomendasi: recommendation.trim() } },
                    { onSuccess: () => setRecommending(false), onError: (error) => setRfqActionError(getApiErrorMessage(error)) },
                  )
                }
              >
                {String(row.vendor?.nama ?? row.vendorId)}
              </Button>
            ))}
          <div>
            <Label htmlFor="selection-recommendation">Dasar rekomendasi</Label>
            <Input id="selection-recommendation" value={recommendation} onChange={(event) => setRecommendation(event.target.value)} placeholder="Ringkasan dasar pemilihan pemenang" />
          </div>
        </div>
      </Modal>
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detail record"
        description="Informasi lengkap record pada tahap pengadaan."
        size="xl"
        contentClassName="max-h-[92dvh]"
        bodyClassName="space-y-6"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Tutup
          </Button>
        }
      >
        {currentSelected ? (
          <div className="space-y-6">
            <section className="rounded-xl border bg-muted/20 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ringkasan record</p>
                  <h3 className="mt-1 break-words text-lg font-semibold">
                    {String(currentSelected.nomor ?? currentSelected.nomorRfq ?? currentSelected.jenisKargo ?? currentSelected.namaKapal ?? currentSelected.jenis ?? "Detail transaksi")}
                  </h3>
                  {currentSelected.status ? <p className="mt-1 text-sm text-muted-foreground">Status: {String(currentSelected.status).replaceAll("_", " ")}</p> : null}
                </div>
              </div>
            </section>
            <section className="rounded-xl border bg-card p-4 sm:p-5">
              <header className="mb-4 border-b pb-3">
                <h3 className="font-semibold">Informasi record</h3>
              </header>
              <dl className="grid gap-3 sm:grid-cols-2">
                {Object.entries(currentSelected)
                  .filter(([key, value]) => !isIdField(key) && value !== undefined)
                  .map(([key, value]) => {
                    const complexValue = value !== null && typeof value === "object";
                    const longValue = typeof value === "string" && value.length > 90;
                    return (
                      <div key={key} className={`min-w-0 rounded-lg border bg-background p-3 ${complexValue || longValue ? "sm:col-span-2" : ""}`}>
                        <dt className="mb-1 text-xs font-medium text-muted-foreground">{fieldLabels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</dt>
                        <dd className="break-words text-sm font-medium text-foreground">
                          <DetailValue value={value} />
                        </dd>
                      </div>
                    );
                  })}
              </dl>
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
