"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Download } from "lucide-react";
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
    ["rfq", "RFQ"],
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
  nomorRfq: "Nomor RFQ",
  hargaPenawaran: "Harga penawaran per satuan",
  mataUang: "Mata uang",
  berlakuSampai: "Berlaku sampai",
  submittedAt: "Dikirim pada",
  revisi: "Revisi",
  contactPerson: "Kontak person",
  npwp: "NPWP",
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
  const [evaluation, setEvaluation] = useState({
    administrasi: false,
    dokumen: false,
    teknis: false,
    legal: false,
    komersial: false,
    delivery: false,
    terms: false,
    sumberHargaAcuan: "",
    nilaiHargaAcuan: "",
    totalBiayaPerolehan: "",
    skor: "",
    alasan: "",
    catatanEvaluasi: "",
  });
  const [recommendation, setRecommendation] = useState("");
  const [documentDownloadId, setDocumentDownloadId] = useState("");
  const [documentDownloadError, setDocumentDownloadError] = useState("");
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
  async function downloadOfferDocument(id: string, name: string) {
    setDocumentDownloadId(id);
    setDocumentDownloadError("");
    try {
      setBrowserToken();
      const cookie = document.cookie
        .split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith("lemigas_session="))
        ?.slice("lemigas_session=".length);
      const { readSession } = await import("@/lib/auth");
      const token = readSession(cookie)?.token;
      const response = await fetch(`${process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001"}/api/vendor-onboarding/me/offers/documents/${encodeURIComponent(id)}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Dokumen tidak dapat diunduh");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDocumentDownloadError(error instanceof Error ? error.message : "Dokumen tidak dapat diunduh");
    } finally {
      setDocumentDownloadId("");
    }
  }
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
  const currentOffers = list(detail.penawaran).filter((offer) => offer.isCurrent !== false && offer.submittedAt);
  const bidByVendor = new Map<string, RecordData>(currentOffers.map((offer) => [String(offer.vendorId), offer]));
  const selectionParticipants = list(selection?.peserta)
    .filter((participant) => bidByVendor.has(String(participant.vendorId)))
    .map<RecordData>((participant) => ({ ...participant, penawaran: bidByVendor.get(String(participant.vendorId)) }))
    .sort((a, b) => {
      const rankA = Number(a.peringkat);
      const rankB = Number(b.peringkat);
      const hasRankA = Number.isFinite(rankA) && rankA > 0;
      const hasRankB = Number.isFinite(rankB) && rankB > 0;
      if (hasRankA && hasRankB) return rankA - rankB;
      if (hasRankA !== hasRankB) return hasRankA ? -1 : 1;
      const scoreA = Number(a.skor);
      const scoreB = Number(b.skor);
      if (Number.isFinite(scoreA) && Number.isFinite(scoreB) && scoreA !== scoreB) return scoreB - scoreA;
      return String(a.vendor?.nama ?? a.vendorId ?? "").localeCompare(String(b.vendor?.nama ?? b.vendorId ?? ""));
    });
  const derived: RecordData = {
    ...detail,
    rfq: stage === "verifikasi_evaluasi" && detail.strategi?.metodeSeleksi !== "pengadaan_langsung" ? [] : detail.rfq,
    negosiasi: list(detail.penawaran).flatMap((offer) => list(offer.negosiasi).map((row) => ({ ...row, vendor: offer.vendor, penawaranId: offer.id }))),
    adendum: list(detail.kontrak).flatMap((contract) => list(contract.adendum).map((row) => ({ ...row, nomorKontrak: contract.nomor }))),
    pemeriksaan: list(detail.pengiriman).flatMap((shipment) => list(shipment.pemeriksaan).map((row) => ({ ...row, nomorBillOfLading: shipment.nomorBillOfLading, pengirimanId: shipment.id }))),
  };
  const currentSelected = selected?.vendorName
    ? selected
    : selected?.id
      ? (Object.values(derived)
          .flatMap((value) => list(value))
          .find((row) => row.id === selected.id) ?? selected)
      : selected;
  const comparison: RecordData[] = list(detail.penawaran)
    .filter((offer) => offer.isCurrent !== false)
    .map((offer) => {
      const negotiations = [...list(offer.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
      const latest = negotiations[0];
      const participant = selectionParticipants.find((row) => row.penawaranId === offer.id) ?? selectionParticipants.find((row) => row.vendorId === offer.vendorId);
      const verificationRecord = list(detail.verifikasi)
        .filter((row) => row.vendorId === offer.vendorId)
        .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
      const baseline = offer.detail?.rfqBaseline && typeof offer.detail.rfqBaseline === "object" ? offer.detail.rfqBaseline : null;
      const requiredDocuments = list(baseline?.dokumenDiminta).filter((document) => document.wajib);
      const uploadedRequirementIds = new Set(list(offer.dokumenPenawaran).map((document) => String(document.requirementId)));
      const uploadedRequiredDocumentCount = requiredDocuments.filter((document) => uploadedRequirementIds.has(String(document.id))).length;
      return {
        ...offer,
        vendorName: offer.vendor?.nama ?? offer.vendorId,
        verification: verificationRecord?.hasil ?? "Belum diverifikasi",
        evaluationStatus: participant?.status ?? "Belum dievaluasi",
        kelulusan: participant
          ? [
              ["A", participant.lulusAdministrasi],
              ["D", participant.lulusDokumen],
              ["T", participant.lulusTeknis],
              ["L", participant.lulusLegal],
              ["K", participant.lulusKomersial],
              ["P", participant.lulusDelivery],
              ["S", participant.lulusTerms],
            ]
              .map(([label, passed]) => (passed ? label : "-"))
              .join(" / ")
          : "Belum dievaluasi",
        sumberHargaAcuan: participant?.sumberHargaAcuan,
        nilaiHargaAcuan: participant?.nilaiHargaAcuan,
        totalBiayaPerolehanEvaluasi: participant?.totalBiayaPerolehan,
        skor: participant?.skor,
        peringkat: participant?.peringkat,
        documentStatus: requiredDocuments.length ? `${uploadedRequiredDocumentCount}/${requiredDocuments.length} wajib` : `${list(offer.dokumenPenawaran).length} lampiran`,
        negotiationCount: negotiations.length,
        putaran: latest?.putaran,
        batasNegosiasi: latest?.batasNegosiasi,
        hargaHasilNegosiasi: latest?.hargaHasilNegosiasi,
        totalBiayaPerolehan: latest?.totalBiayaPerolehan,
        negotiationStatus: latest?.status ?? "Belum dinegosiasikan",
        tanggapanVendor: latest?.tanggapanVendor ?? "Belum ada tanggapan",
        hasil: latest?.hasil,
      };
    });
  const offerComparisonStages = new Set(["pemilihan_penyedia", "permintaan_penawaran", "penawaran_vendor", "sourcing"]);
  const evaluationComparisonStages = new Set(["verifikasi_evaluasi", "rekomendasi_pemenang"]);
  const negotiationComparisonStages = new Set(["klarifikasi_negosiasi", "uji_kewajaran_negosiasi", "evaluasi_negosiasi"]);
  const showOfferComparison = offerComparisonStages.has(stage) || evaluationComparisonStages.has(stage) || negotiationComparisonStages.has(stage);
  const comparisonColumns = [
    { key: "vendorName", header: "Vendor", render: (row: RecordData) => text(row.vendorName) },
    { key: "nomorRfq", header: "RFQ", render: (row: RecordData) => text(row.nomorRfq) },
    { key: "hargaPenawaran", header: "Harga per satuan", render: (row: RecordData) => text(row.hargaPenawaran) },
    { key: "mataUang", header: "Mata uang", render: (row: RecordData) => text(row.mataUang) },
    ...(offerComparisonStages.has(stage)
      ? [
          { key: "revisi", header: "Revisi", render: (row: RecordData) => text(row.revisi) },
          { key: "submittedAt", header: "Dikirim", render: (row: RecordData) => date(row.submittedAt) },
          { key: "berlakuSampai", header: "Berlaku sampai", render: (row: RecordData) => date(row.berlakuSampai) },
          { key: "documentStatus", header: "Dokumen", render: (row: RecordData) => text(row.documentStatus) },
        ]
      : []),
    ...(evaluationComparisonStages.has(stage)
      ? [
          { key: "documentStatus", header: "Dokumen", render: (row: RecordData) => text(row.documentStatus) },
          { key: "verification", header: "Verifikasi", render: (row: RecordData) => text(row.verification) },
          { key: "kelulusan", header: "Kelulusan A/D/T/L/K/P/S", render: (row: RecordData) => text(row.kelulusan) },
          { key: "sumberHargaAcuan", header: "Sumber harga acuan", render: (row: RecordData) => text(row.sumberHargaAcuan) },
          { key: "nilaiHargaAcuan", header: "Harga acuan per satuan", render: (row: RecordData) => text(row.nilaiHargaAcuan) },
          { key: "totalBiayaPerolehanEvaluasi", header: "Total biaya perolehan evaluasi", render: (row: RecordData) => text(row.totalBiayaPerolehanEvaluasi) },
          { key: "evaluationStatus", header: "Status evaluasi", render: (row: RecordData) => text(row.evaluationStatus) },
          { key: "skor", header: "Skor", render: (row: RecordData) => text(row.skor) },
          { key: "peringkat", header: "Peringkat", render: (row: RecordData) => text(row.peringkat) },
        ]
      : []),
    ...(negotiationComparisonStages.has(stage)
      ? [
          { key: "putaran", header: "Putaran terbaru", render: (row: RecordData) => (row.putaran ? `${text(row.putaran)} dari ${text(row.negotiationCount)}` : "Belum dinegosiasikan") },
          { key: "batasNegosiasi", header: "Target internal per satuan", render: (row: RecordData) => text(row.batasNegosiasi) },
          { key: "hargaHasilNegosiasi", header: "Harga negosiasi per satuan", render: (row: RecordData) => text(row.hargaHasilNegosiasi) },
          { key: "totalBiayaPerolehan", header: "Total biaya perolehan evaluasi", render: (row: RecordData) => text(row.totalBiayaPerolehan) },
          { key: "negotiationStatus", header: "Status negosiasi", render: (row: RecordData) => text(row.negotiationStatus) },
          { key: "tanggapanVendor", header: "Tanggapan vendor", render: (row: RecordData) => text(row.tanggapanVendor) },
          { key: "hasil", header: "Hasil", render: (row: RecordData) => text(row.hasil ?? "Belum ada hasil") },
        ]
      : []),
    {
      key: "detail",
      header: "Detail",
      render: (row: RecordData) => (
        <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
          Lihat
        </Button>
      ),
    },
  ];
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
            <span>Pemilihan penyedia</span>
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Ada data</span>
              <span className="text-xs font-normal text-muted-foreground">{String(selection.status ?? "draft").replaceAll("_", " ")}</span>
            </span>
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
                {
                  key: "status",
                  header: "Status",
                  render: (row) => {
                    const incomplete = !row.status || row.status === "draft" || row.status === "belum_dievaluasi";
                    return <span className={incomplete ? "font-medium text-destructive" : ""}>{incomplete ? "Belum selesai" : text(row.status)}</span>;
                  },
                },
                { key: "skor", header: "Skor", render: (row) => (row.skor == null ? <span className="font-medium text-destructive">Belum diisi</span> : text(row.skor)) },
                { key: "peringkat", header: "Peringkat", render: (row) => (row.peringkat == null ? <span className="font-medium text-destructive">Belum dihitung</span> : text(row.peringkat)) },
                {
                  key: "kelulusan",
                  header: "Kelulusan",
                  render: (row) => {
                    const criteria = [
                      ["Administrasi", row.lulusAdministrasi],
                      ["Dokumen", row.lulusDokumen],
                      ["Teknis", row.lulusTeknis],
                      ["Legal", row.lulusLegal],
                      ["Komersial", row.lulusKomersial],
                      ["Delivery", row.lulusDelivery],
                      ["Terms", row.lulusTerms],
                    ] as const;
                    return (
                      <span className="inline-flex gap-1.5">
                        {criteria.map(([label, passed]) => (
                          <span key={label} className={passed == null ? "font-medium text-destructive" : ""} title={passed == null ? `${label} belum dinilai` : undefined}>
                            {passed == null ? `${label} belum dinilai` : `${label} ${passed ? "Lulus" : "Tidak lulus"}`}
                          </span>
                        ))}
                      </span>
                    );
                  },
                },
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
                          dokumen: Boolean(row.lulusDokumen),
                          teknis: Boolean(row.lulusTeknis),
                          legal: Boolean(row.lulusLegal),
                          komersial: Boolean(row.lulusKomersial),
                          delivery: Boolean(row.lulusDelivery),
                          terms: Boolean(row.lulusTerms),
                          sumberHargaAcuan: String(row.sumberHargaAcuan ?? ""),
                          nilaiHargaAcuan: row.nilaiHargaAcuan == null ? "" : String(row.nilaiHargaAcuan),
                          totalBiayaPerolehan: row.totalBiayaPerolehan == null ? "" : String(row.totalBiayaPerolehan),
                          skor: row.skor == null ? "" : String(row.skor),
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
      {showOfferComparison && (
        <details className="group rounded-lg border px-4" open>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
            Perbandingan penawaran
            <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t py-4">
            <p className="text-xs text-muted-foreground">
              {negotiationComparisonStages.has(stage)
                ? "Negosiasi memakai putaran tertinggi. Biaya tetap menggunakan mata uang masing-masing tanpa konversi kurs."
                : evaluationComparisonStages.has(stage)
                  ? "Status evaluasi terkait dengan revisi penawaran aktif yang sedang dinilai."
                  : "Hanya revisi penawaran aktif ditampilkan. Kelengkapan dokumen dihitung dari persyaratan wajib RFQ."}
            </p>
            <DataTable rows={comparison} rowKey={(row) => row.id} emptyMessage="Belum ada penawaran." columns={comparisonColumns} />
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
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span>
                  {title}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({rows.length})</span>
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rows.length ? "bg-emerald-100 text-emerald-800" : "bg-destructive/10 text-destructive"}`}>{rows.length ? "Ada data" : "Belum lengkap"}</span>
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
              disabled={
                selectionMutation.isPending ||
                !evaluation.sumberHargaAcuan.trim() ||
                evaluation.nilaiHargaAcuan === "" ||
                !Number.isFinite(Number(evaluation.nilaiHargaAcuan)) ||
                Number(evaluation.nilaiHargaAcuan) < 0 ||
                evaluation.totalBiayaPerolehan === "" ||
                !Number.isFinite(Number(evaluation.totalBiayaPerolehan)) ||
                Number(evaluation.totalBiayaPerolehan) < 0 ||
                (evaluation.skor !== "" && (!Number.isFinite(Number(evaluation.skor)) || Number(evaluation.skor) < 0 || Number(evaluation.skor) > 100))
              }
              onClick={() => {
                if (!evaluating) return;
                selectionMutation.mutate(
                  {
                    path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/pemilihan-penyedia/peserta/${encodeURIComponent(String(evaluating.id))}`,
                    method: "PUT",
                    body: {
                      lulusAdministrasi: evaluation.administrasi,
                      lulusDokumen: evaluation.dokumen,
                      lulusTeknis: evaluation.teknis,
                      lulusLegal: evaluation.legal,
                      lulusKomersial: evaluation.komersial,
                      lulusDelivery: evaluation.delivery,
                      lulusTerms: evaluation.terms,
                      sumberHargaAcuan: evaluation.sumberHargaAcuan.trim(),
                      nilaiHargaAcuan: Number(evaluation.nilaiHargaAcuan),
                      totalBiayaPerolehan: Number(evaluation.totalBiayaPerolehan),
                      ...(evaluation.skor !== "" ? { skor: Number(evaluation.skor) } : {}),
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
        <div className="space-y-5">
          {evaluating ? (
            <section className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Penawaran yang dievaluasi</p>
              <p className="mt-1 font-semibold">{String(evaluating.vendor?.nama ?? evaluating.vendorId)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                RFQ {String(evaluating.penawaran?.nomorRfq ?? evaluating.rfq?.nomor ?? "—")} · Revisi {String(evaluating.penawaran?.revisi ?? "—")}
              </p>
              <p className="mt-1 text-sm">
                Harga penawaran per satuan: {text(evaluating.penawaran?.mataUang)} {text(evaluating.penawaran?.hargaPenawaran)}
                {evaluating.penawaran?.detail?.rfqBaseline?.satuan ? ` / ${text(evaluating.penawaran.detail.rfqBaseline.satuan)}` : ""}
              </p>
            </section>
          ) : null}
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">1. Pemeriksaan kelulusan</h3>
              <p className="mt-1 text-sm text-muted-foreground">Peserta lulus hanya bila seluruh aspek pemeriksaan terpenuhi.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["administrasi", "Administrasi"],
                  ["dokumen", "Dokumen"],
                  ["teknis", "Teknis"],
                  ["legal", "Legal"],
                  ["komersial", "Komersial"],
                  ["delivery", "Kemampuan delivery"],
                  ["terms", "Ketentuan komersial"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium">
                  <input type="checkbox" checked={evaluation[key]} onChange={(event) => setEvaluation((value) => ({ ...value, [key]: event.target.checked }))} />
                  Lulus {label.toLowerCase()}
                </label>
              ))}
            </div>
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">2. Uji kewajaran harga</h3>
              <p className="mt-1 text-xs text-muted-foreground">Bandingkan nilai per satuan dalam mata uang dan satuan sama. Total biaya perolehan memuat seluruh biaya sampai barang diterima.</p>
            </div>
            {evaluating ? (
              <div className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950">
                Konteks pembanding: <strong>{text(evaluating.penawaran?.mataUang)}</strong>
                {evaluating.penawaran?.detail?.rfqBaseline?.satuan ? (
                  <>
                    {" "}
                    per <strong>{text(evaluating.penawaran.detail.rfqBaseline.satuan)}</strong>
                  </>
                ) : null}
                {evaluating.penawaran?.detail?.rfqBaseline?.volume ? (
                  <>
                    {" "}
                    · volume{" "}
                    <strong>
                      {text(evaluating.penawaran.detail.rfqBaseline.volume)} {text(evaluating.penawaran.detail.rfqBaseline.satuan)}
                    </strong>
                  </>
                ) : null}
              </div>
            ) : null}
            {evaluating?.penawaran?.hargaPenawaran != null && evaluating.penawaran?.detail?.rfqBaseline?.volume != null ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                Subtotal barang dari penawaran:{" "}
                <strong>
                  {text(evaluating.penawaran.mataUang)} {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(Number(evaluating.penawaran.hargaPenawaran) * Number(evaluating.penawaran.detail.rfqBaseline.volume))}
                </strong>
                <p className="mt-0.5 text-xs text-muted-foreground">Harga penawaran per satuan × volume RFQ. Nilai ini belum termasuk komponen biaya perolehan lain.</p>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="selection-reference-source">Sumber harga acuan *</Label>
              <p className="text-xs leading-4 text-muted-foreground">Cantumkan nama sumber serta tanggal atau periode harga agar dapat diaudit.</p>
              <Input
                id="selection-reference-source"
                value={evaluation.sumberHargaAcuan}
                onChange={(event) => setEvaluation((value) => ({ ...value, sumberHargaAcuan: event.target.value }))}
                placeholder="Contoh: Platts MOPS, publikasi 23 Oktober 2026"
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="selection-reference-value">Harga acuan per satuan *</Label>
                <p className="text-xs leading-4 text-muted-foreground">Mata uang dan satuan harus sama dengan harga penawaran.</p>
                <Input
                  id="selection-reference-value"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={evaluation.nilaiHargaAcuan}
                  onChange={(event) => setEvaluation((value) => ({ ...value, nilaiHargaAcuan: event.target.value }))}
                  placeholder="Contoh: 92.50"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="selection-acquisition-cost">Total biaya perolehan untuk volume RFQ *</Label>
                <p className="text-xs leading-4 text-muted-foreground">Subtotal barang + freight + asuransi + pajak/bea + inspeksi + biaya lain − diskon. Isi total akhir, bukan harga per satuan.</p>
                <Input
                  id="selection-acquisition-cost"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={evaluation.totalBiayaPerolehan}
                  onChange={(event) => setEvaluation((value) => ({ ...value, totalBiayaPerolehan: event.target.value }))}
                  placeholder="Jumlah akhir dalam mata uang penawaran"
                />
              </div>
            </div>
            {evaluation.nilaiHargaAcuan !== "" && evaluating?.penawaran?.hargaPenawaran != null && Number(evaluation.nilaiHargaAcuan) > 0 ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                Selisih harga penawaran terhadap acuan:{" "}
                <strong>
                  {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2, signDisplay: "always" }).format(((Number(evaluating.penawaran.hargaPenawaran) - Number(evaluation.nilaiHargaAcuan)) / Number(evaluation.nilaiHargaAcuan)) * 100)}%
                </strong>
              </p>
            ) : null}
          </section>
          <section className="space-y-3 rounded-xl border p-4">
            <div>
              <Label htmlFor="selection-score">3. Skor evaluasi (0–100)</Label>
              <p className="mt-1 text-xs text-muted-foreground">Masukkan nilai akhir berbobot. Peringkat dihitung otomatis dari skor peserta yang lulus.</p>
            </div>
            <Input
              id="selection-score"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={evaluation.skor}
              aria-invalid={evaluation.skor !== "" && (Number(evaluation.skor) < 0 || Number(evaluation.skor) > 100)}
              onChange={(event) => setEvaluation((value) => ({ ...value, skor: event.target.value }))}
              placeholder="0–100"
            />
            {evaluation.skor !== "" && (Number(evaluation.skor) < 0 || Number(evaluation.skor) > 100) ? <p className="text-xs text-destructive">Skor harus berada pada rentang 0 sampai 100.</p> : null}
            <p className="text-sm text-muted-foreground">
              Peringkat saat ini: <strong className="text-foreground">{evaluating?.peringkat ? `#${evaluating.peringkat}` : "Belum dihitung"}</strong>
            </p>
          </section>
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">4. Catatan evaluasi</h3>
              <p className="mt-1 text-sm text-muted-foreground">Alasan dan catatan membantu audit keputusan.</p>
            </div>
            <div>
              <Label htmlFor="selection-reason">Alasan evaluasi</Label>
              <textarea
                id="selection-reason"
                rows={2}
                value={evaluation.alasan}
                onChange={(event) => setEvaluation((value) => ({ ...value, alasan: event.target.value }))}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="selection-notes">Catatan evaluasi</Label>
              <textarea
                id="selection-notes"
                rows={3}
                value={evaluation.catatanEvaluasi}
                onChange={(event) => setEvaluation((value) => ({ ...value, catatanEvaluasi: event.target.value }))}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </section>
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
          <div className="space-y-5">
            {(() => {
              const isOffer = currentSelected.hargaPenawaran !== undefined;
              const title = String(
                isOffer
                  ? (currentSelected.vendor?.nama ?? currentSelected.nomorRfq ?? "Penawaran vendor")
                  : (currentSelected.nomor ?? currentSelected.nomorRfq ?? currentSelected.jenisKargo ?? currentSelected.namaKapal ?? currentSelected.jenis ?? "Detail transaksi"),
              );
              const hasCanonicalRfq = ["volume", "satuan", "titikSerah", "spesifikasi", "dokumenDiminta", "syaratPembayaran", "syaratPenyerahan"].some((key) => currentSelected[key] != null);
              const offerInternalFields = new Set(["ketentuanPengangkutan", "syaratPembayaran", "isCurrent", "revisiDariId", "nomorRfq", "vendor", "detail", "submittedAt", "updatedAt"]);
              const entries = Object.entries(currentSelected).filter(
                ([key, value]) => !isIdField(key) && value !== undefined && value !== null && value !== "" && !(hasCanonicalRfq && key === "ketentuan") && !(isOffer && offerInternalFields.has(key)),
              );
              const scalarEntries = entries.filter(([, value]) => typeof value !== "object");
              const complexEntries = entries.filter(([key, value]) => value !== null && typeof value === "object" && !(isOffer && key === "detail"));
              const offerDetail = isOffer && currentSelected.detail && typeof currentSelected.detail === "object" ? currentSelected.detail : null;
              const rfqBaseline = offerDetail?.rfqBaseline && typeof offerDetail.rfqBaseline === "object" ? offerDetail.rfqBaseline : null;
              const labelFor = (key: string) => fieldLabels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
              return (
                <>
                  <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.07] via-background to-background p-5 shadow-sm sm:p-6">
                    <div className="absolute inset-y-0 left-0 w-1 bg-primary/70" />
                    <div className="flex flex-wrap items-start justify-between gap-4 pl-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{isOffer ? "Penawaran vendor" : currentSelected.nomorRfq ? "Permintaan penawaran" : "Record transaksi"}</p>
                        <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{isOffer ? `RFQ ${currentSelected.nomorRfq ?? "—"} · Revisi ${currentSelected.revisi ?? 1}` : "Informasi dan ketentuan tersimpan pada tahap pengadaan ini."}</p>
                      </div>
                      {currentSelected.status ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1.5 text-xs font-semibold capitalize text-foreground shadow-sm">
                          <span className="size-2 rounded-full bg-primary" />
                          {String(currentSelected.status).replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </div>
                  </section>
                  <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
                    <header className="flex items-end justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="font-semibold tracking-tight">Informasi record</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Ringkasan data dan atribut utama.</p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{isOffer ? "Ringkasan penawaran" : `${entries.length} field`}</span>
                    </header>
                    {isOffer && currentSelected.vendor ? (
                      <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {String(currentSelected.vendor.nama ?? "V")
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <div>
                          <p className="text-xs text-muted-foreground">Vendor</p>
                          <p className="text-sm font-semibold">{String(currentSelected.vendor.nama ?? "—")}</p>
                        </div>
                      </div>
                    ) : null}
                    {scalarEntries.length ? (
                      <dl className={`grid gap-3 ${isOffer ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                        {scalarEntries.map(([key, value]) => (
                          <div key={key} className="group min-w-0 rounded-xl border bg-background p-3.5 transition-colors hover:bg-muted/20">
                            <dt className="text-xs font-medium text-muted-foreground">{labelFor(key)}</dt>
                            <dd className="mt-1.5 break-words text-sm font-medium leading-relaxed text-foreground">
                              <DetailValue value={value} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {isOffer && offerDetail?.catatan ? (
                      <section className="rounded-xl border bg-background p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Catatan vendor</h4>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{String(offerDetail.catatan)}</p>
                      </section>
                    ) : null}
                    {isOffer && Array.isArray(currentSelected.dokumenPenawaran) && currentSelected.dokumenPenawaran.length ? (
                      <section className="overflow-hidden rounded-xl border bg-background">
                        <h4 className="border-b bg-muted/25 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dokumen yang diunggah</h4>
                        <div className="space-y-2 p-4">
                          {currentSelected.dokumenPenawaran.map((item: Record<string, any>, index: number) => {
                            const doc = item.dokumen ?? item;
                            return (
                              <div key={String(doc.id ?? index)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="break-words text-sm font-medium">{String(doc.nama ?? `Dokumen ${index + 1}`)}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{String(item.requirementId ?? "Dokumen penawaran")}</p>
                                </div>
                                <Button type="button" size="sm" variant="outline" disabled={documentDownloadId === String(doc.id)} onClick={() => void downloadOfferDocument(String(doc.id), String(doc.nama ?? `dokumen-${index + 1}`))}>
                                  <Download size={14} />
                                  {documentDownloadId === String(doc.id) ? "Mengunduh…" : "Unduh"}
                                </Button>
                              </div>
                            );
                          })}
                          {documentDownloadError ? (
                            <p role="alert" className="text-sm text-destructive">
                              {documentDownloadError}
                            </p>
                          ) : null}
                        </div>
                      </section>
                    ) : null}
                    {isOffer && (!Array.isArray(currentSelected.dokumenPenawaran) || currentSelected.dokumenPenawaran.length === 0) ? (
                      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">Belum ada dokumen yang diunggah untuk penawaran ini.</p>
                    ) : null}
                    {rfqBaseline ? (
                      <section className="overflow-hidden rounded-xl border bg-background">
                        <h4 className="border-b bg-muted/25 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acuan kebutuhan RFQ</h4>
                        <div className="space-y-4 p-4">
                          <dl className="grid gap-3 sm:grid-cols-2">
                            {(
                              [
                                ["volume", "Volume"],
                                ["satuan", "Satuan"],
                                ["titikSerah", "Titik serah"],
                                ["syaratPenyerahan", "Syarat penyerahan"],
                                ["syaratPembayaran", "Syarat pembayaran"],
                              ] as Array<[string, string]>
                            )
                              .filter(([key]) => rfqBaseline[key] != null && rfqBaseline[key] !== "")
                              .map(([key, label]) => (
                                <div key={key} className="rounded-lg bg-muted/25 p-3">
                                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{typeof rfqBaseline[key] === "object" ? <DetailValue value={rfqBaseline[key]} /> : String(rfqBaseline[key])}</dd>
                                </div>
                              ))}
                          </dl>
                          {rfqBaseline.spesifikasi ? (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spesifikasi</p>
                              <DetailValue value={rfqBaseline.spesifikasi} />
                            </div>
                          ) : null}
                          {Array.isArray(rfqBaseline.dokumenDiminta) && rfqBaseline.dokumenDiminta.length ? (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dokumen diminta</p>
                              <div className="space-y-2">
                                {rfqBaseline.dokumenDiminta.map((document: Record<string, unknown>, index: number) => {
                                  const attachedDocument = list(currentSelected.dokumenPenawaran).find((item) => String(item.requirementId) === String(document.id));
                                  const uploadedFile = attachedDocument?.dokumen ?? attachedDocument;
                                  return (
                                    <div key={String(document.id ?? index)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                                      <span className="text-sm font-medium">{String(document.nama ?? `Dokumen ${index + 1}`)}</span>
                                      <span className="rounded-full bg-muted px-2 py-1 text-xs">{document.wajib ? "Wajib" : "Opsional"}</span>
                                      {document.keterangan ? <p className="w-full text-xs text-muted-foreground">{String(document.keterangan)}</p> : null}
                                      {uploadedFile?.id ? (
                                        <div className="flex w-full items-center justify-between gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                                          <span className="min-w-0 truncate">Terunggah: {String(uploadedFile.nama ?? "Dokumen")}</span>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={documentDownloadId === String(uploadedFile.id)}
                                            onClick={() => void downloadOfferDocument(String(uploadedFile.id), String(uploadedFile.nama ?? `dokumen-${index + 1}`))}
                                          >
                                            <Download size={14} />
                                            {documentDownloadId === String(uploadedFile.id) ? "Mengunduh…" : "Unduh"}
                                          </Button>
                                        </div>
                                      ) : (
                                        <p className="w-full text-xs text-muted-foreground">Belum ada berkas yang diunggah</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </section>
                    ) : null}
                    {complexEntries.length ? (
                      <div className="space-y-3">
                        {complexEntries.map(([key, value]) => (
                          <section key={key} className="overflow-hidden rounded-xl border bg-background">
                            <h4 className="border-b bg-muted/25 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{labelFor(key)}</h4>
                            <div className="p-4">
                              <DetailValue value={value} />
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : null}
                  </section>
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
