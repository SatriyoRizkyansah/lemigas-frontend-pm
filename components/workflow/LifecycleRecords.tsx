"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download } from "lucide-react";
import { useCurrentUser } from "@/lib/api/hooks";
import { DataTable } from "@/components/table/DataTable";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { EmptyState } from "@/components/loading/EmptyState";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { ContentType } from "@/lib/api/generated/api-generated";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getApiErrorMessage } from "@/lib/api/errors";
type RecordData = Record<string, any>;
type AcquisitionCostKey = "freight" | "asuransi" | "kepelabuhanan" | "penyimpanan" | "pajakKepabeanan" | "inspeksi" | "pembiayaan" | "biayaLain" | "diskon";
type AcquisitionCostComponent = { nilai: string; includedInOffer: boolean; sumber: string; statusNilai: "estimasi" | "final" };
const ACQUISITION_COST_FIELDS: Array<{ key: AcquisitionCostKey; label: string; subtract?: boolean }> = [
  { key: "freight", label: "Pengangkutan / freight" },
  { key: "asuransi", label: "Asuransi" },
  { key: "kepelabuhanan", label: "Kepelabuhanan" },
  { key: "penyimpanan", label: "Penyimpanan" },
  { key: "pajakKepabeanan", label: "Pajak dan kepabeanan" },
  { key: "inspeksi", label: "Inspeksi" },
  { key: "pembiayaan", label: "Pembiayaan / perbankan" },
  { key: "biayaLain", label: "Biaya langsung lain" },
  { key: "diskon", label: "Diskon / kredit", subtract: true },
];
const emptyAcquisitionCosts = () => Object.fromEntries(ACQUISITION_COST_FIELDS.map(({ key }) => [key, { nilai: "", includedInOffer: false, sumber: "", statusNilai: "estimasi" }])) as Record<AcquisitionCostKey, AcquisitionCostComponent>;
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
const asRecord = (value: any): RecordData => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const text = (value: any): string =>
  value == null || value === ""
    ? "—"
    : typeof value === "object"
      ? Object.entries(value)
          .map(([key, item]) => `${key}: ${String(item ?? "—")}`)
          .join(" · ")
      : String(value);
const date = (value: any) => (value ? new Date(value).toLocaleString("id-ID") : "—");
const negotiationStatus = (value: any): string =>
  ({
    menunggu_tanggapan: "Menunggu tanggapan vendor",
    disepakati: "Disepakati",
    ditolak: "Ditolak vendor",
    digantikan: "Digantikan putaran baru",
    dibatalkan: "Diakhiri tanpa kesepakatan",
  })[String(value)] ?? text(value);
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
  const [evaluating, setEvaluating] = useState<RecordData | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendationDetailId, setRecommendationDetailId] = useState("");
  const [selectedRecommendationParticipant, setSelectedRecommendationParticipant] = useState("");
  const [recommendation, setRecommendation] = useState("");
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
    komponenBiayaPerolehan: emptyAcquisitionCosts(),
    skor: "",
    alasan: "",
    catatanEvaluasi: "",
  });
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
  const recommendationState = use_query<RecordData, Error, string>({
    tag: "siklusTransaksiKomoditas",
    method: "recommendationState",
    params: pengadaanId,
    enabled: stage === "rekomendasi_pemenang",
    queryFn: async (id) => {
      setBrowserToken();
      const response = await apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(id)}/pemilihan-penyedia/rekomendasi`,
          method: "GET",
          secure: true,
          format: "json",
        }) as Promise<{ data: unknown }>,
      );
      return (response as RecordData)?.data ?? response;
    },
  });
  const recommendationData = recommendationState.data;
  useEffect(() => {
    const openRecommendation = () => {
      if (stage === "rekomendasi_pemenang" && active) {
        const ownVote = recommendationState.data?.myVote as RecordData | undefined;
        setSelectedRecommendationParticipant(ownVote?.pesertaId == null ? "" : String(ownVote.pesertaId));
        setRecommendation(ownVote?.alasan == null ? "" : String(ownVote.alasan));
        setRecommending(true);
      }
    };
    window.addEventListener("lifecycle:open-recommendation", openRecommendation);
    return () => window.removeEventListener("lifecycle:open-recommendation", openRecommendation);
  }, [active, recommendationState.data, stage]);
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
  const selectionParticipantsBase = list(selection?.peserta)
    .filter((participant) => bidByVendor.has(String(participant.vendorId)))
    .map<RecordData>((participant) => ({ ...participant, penawaran: bidByVendor.get(String(participant.vendorId)) }));
  const computedRankByParticipantId = new Map(
    selectionParticipantsBase
      .filter((participant) => participant.skor != null && Number.isFinite(Number(participant.skor)))
      .sort((a, b) => Number(b.skor) - Number(a.skor) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || String(a.id).localeCompare(String(b.id)))
      .map((participant, index) => [String(participant.id), index + 1] as const),
  );
  const selectionParticipants = selectionParticipantsBase
    .map<RecordData>((participant) => ({
      ...participant,
      peringkat: computedRankByParticipantId.get(String(participant.id)) ?? null,
    }))
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
    kontrak: detail.kontrak,
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
  const negotiationComparisonStages = new Set(["klarifikasi_negosiasi", "uji_kewajaran_negosiasi", "evaluasi_negosiasi", "rekomendasi_pemenang"]);
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
          { key: "negotiationStatus", header: "Status negosiasi", render: (row: RecordData) => negotiationStatus(row.negotiationStatus) },
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
  const offerSubtotal = evaluating?.penawaran?.hargaPenawaran != null && evaluating.penawaran?.detail?.rfqBaseline?.volume != null ? Number(evaluating.penawaran.hargaPenawaran) * Number(evaluating.penawaran.detail.rfqBaseline.volume) : 0;
  const acquisitionTotal = ACQUISITION_COST_FIELDS.reduce((total, { key, subtract }) => {
    const component = evaluation.komponenBiayaPerolehan[key];
    const amount = component.nilai === "" || !Number.isFinite(Number(component.nilai)) ? 0 : Number(component.nilai);
    if (subtract) return total - amount;
    return component.includedInOffer ? total : total + amount;
  }, offerSubtotal);
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
                          komponenBiayaPerolehan: Object.fromEntries(
                            ACQUISITION_COST_FIELDS.map(({ key }) => {
                              const saved = row.komponenBiayaPerolehan?.[key];
                              return [
                                key,
                                {
                                  nilai: saved?.nilai == null ? "" : String(saved.nilai),
                                  includedInOffer: Boolean(saved?.includedInOffer),
                                  sumber: String(saved?.sumber ?? ""),
                                  statusNilai: saved?.statusNilai === "final" ? "final" : "estimasi",
                                },
                              ];
                            }),
                          ) as Record<AcquisitionCostKey, AcquisitionCostComponent>,
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
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rows.length ? "bg-emerald-100 text-emerald-800" : key === "adendum" ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive"}`}>{rows.length ? "Ada data" : key === "adendum" ? "Opsional" : "Belum lengkap"}</span>
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
                Object.values(evaluation.komponenBiayaPerolehan).some(
                  (component) => component.nilai !== "" && (!Number.isFinite(Number(component.nilai)) || Number(component.nilai) < 0 || (Number(component.nilai) > 0 && !component.sumber.trim())),
                ) ||
                acquisitionTotal < 0 ||
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
                      komponenBiayaPerolehan: Object.fromEntries(
                        Object.entries(evaluation.komponenBiayaPerolehan).map(([key, component]) => [key, { ...component, nilai: component.nilai === "" ? 0 : Number(component.nilai), sumber: component.sumber.trim() }]),
                      ),
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
              <p className="mt-1 text-xs text-muted-foreground">Bandingkan nilai per satuan dalam mata uang dan satuan sama. Total biaya perolehan memuat seluruh biaya langsung sampai Titik Serah.</p>
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
              <div className="space-y-3 rounded-lg border p-3">
                <div>
                  <Label>Rincian biaya langsung sampai Titik Serah</Label>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">Isi hanya biaya yang relevan. Tandai “sudah termasuk” agar sistem tidak menghitung komponen dua kali.</p>
                </div>
                {ACQUISITION_COST_FIELDS.map(({ key, label, subtract }) => {
                  const component = evaluation.komponenBiayaPerolehan[key];
                  return (
                    <div key={key} className="space-y-2 rounded-lg bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {label}
                          {subtract ? " (pengurang)" : ""}
                        </span>
                        {!subtract ? (
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={component.includedInOffer}
                              onChange={(event) => setEvaluation((current) => ({ ...current, komponenBiayaPerolehan: { ...current.komponenBiayaPerolehan, [key]: { ...component, includedInOffer: event.target.checked } } }))}
                            />
                            Sudah termasuk harga penawaran
                          </label>
                        ) : null}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                        <Input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={component.nilai}
                          onChange={(event) => setEvaluation((current) => ({ ...current, komponenBiayaPerolehan: { ...current.komponenBiayaPerolehan, [key]: { ...component, nilai: event.target.value } } }))}
                          placeholder={`Nilai ${text(evaluating?.penawaran?.mataUang)}`}
                        />
                        <Input
                          value={component.sumber}
                          onChange={(event) => setEvaluation((current) => ({ ...current, komponenBiayaPerolehan: { ...current.komponenBiayaPerolehan, [key]: { ...component, sumber: event.target.value } } }))}
                          placeholder={Number(component.nilai) > 0 ? "Sumber / dasar nilai *" : "Sumber / dasar nilai"}
                          aria-invalid={Number(component.nilai) > 0 && !component.sumber.trim()}
                        />
                        <FilterCombobox
                          options={[
                            { value: "estimasi", label: "Estimasi" },
                            { value: "final", label: "Final" },
                          ]}
                          value={component.statusNilai}
                          onValueChange={(value) => setEvaluation((current) => ({ ...current, komponenBiayaPerolehan: { ...current.komponenBiayaPerolehan, [key]: { ...component, statusNilai: value as "estimasi" | "final" } } }))}
                          label="status nilai"
                          searchPlaceholder="Cari status nilai..."
                          emptyLabel="Pilih status nilai"
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-lg border bg-background px-3 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span>Subtotal kargo</span>
                    <strong>
                      {text(evaluating?.penawaran?.mataUang)} {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(offerSubtotal)}
                    </strong>
                  </div>
                  <div className="mt-2 flex justify-between gap-3 border-t pt-2 text-base">
                    <span>Total Biaya Perolehan</span>
                    <strong>
                      {text(evaluating?.penawaran?.mataUang)} {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(acquisitionTotal)}
                    </strong>
                  </div>
                  {acquisitionTotal < 0 ? <p className="mt-1 text-xs text-destructive">Diskon tidak boleh melebihi subtotal kargo dan biaya tambahan.</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">Dihitung otomatis. Perhitungan final diverifikasi kembali oleh server saat evaluasi disimpan.</p>
                </div>
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
              <p className="mt-1 text-xs text-muted-foreground">Masukkan nilai akhir berbobot. Peringkat dihitung otomatis dari skor seluruh peserta yang sudah dinilai; kelulusan tetap menentukan kelayakan untuk tahap berikutnya.</p>
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
        title="Rekomendasi kolektif calon pemenang"
        description="Setiap petugas aktif memberikan satu suara beserta alasan. Rekomendasi bukan penetapan pemenang."
        size="xl"
        footer={
          <>
            <Button variant="outline" disabled={selectionMutation.isPending} onClick={() => setRecommending(false)}>
              Tutup
            </Button>
            {Boolean(recommendationData?.canVote) && (
              <Button
                disabled={!selectedRecommendationParticipant || !recommendation.trim() || selectionMutation.isPending}
                onClick={() =>
                  selectionMutation.mutate(
                    { path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/pemilihan-penyedia/rekomendasi/me`, method: "PUT", body: { pesertaId: selectedRecommendationParticipant, alasan: recommendation.trim() } },
                    {
                      onSuccess: () => {
                        setRecommendation("");
                        void recommendationState.refetch();
                      },
                      onError: (error) => setRfqActionError(getApiErrorMessage(error)),
                    },
                  )
                }
              >
                {recommendationData?.myVote ? "Perbarui suara" : "Simpan suara"}
              </Button>
            )}
            {Boolean(recommendationData?.canFinalize) && Boolean((recommendationData?.quorum as RecordData | undefined)?.complete) && text((recommendationData?.result as RecordData | undefined)?.state) === "unique_winner" && (
              <Button
                disabled={selectionMutation.isPending}
                onClick={() =>
                  selectionMutation.mutate(
                    { path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/pemilihan-penyedia/rekomendasi/finalize`, method: "POST", body: {} },
                    { onSuccess: () => void recommendationState.refetch(), onError: (error) => setRfqActionError(getApiErrorMessage(error)) },
                  )
                }
              >
                Finalisasi rekomendasi
              </Button>
            )}
          </>
        }
      >
        {recommendationState.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat data rekomendasi...</p>
        ) : recommendationState.isError ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Data rekomendasi tidak dapat dimuat.</p>
        ) : (
          <div className="space-y-5">
            {(() => {
              const quorum = (recommendationData?.quorum ?? {}) as RecordData;
              const resultValue = (recommendationData?.result as RecordData | undefined)?.state;
              const resultState = resultValue == null ? "incomplete" : String(resultValue);
              const labels: Record<string, string> = { incomplete: "Menunggu seluruh petugas", tie: "Hasil suara seri", unique_winner: "Kandidat unggul tersedia", finalized: "Rekomendasi telah difinalisasi" };
              return (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Partisipasi</p>
                    <p className="mt-1 text-lg font-semibold">
                      {quorum.submitted == null ? "0" : String(quorum.submitted)} / {quorum.required == null ? "0" : String(quorum.required)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="mt-1 font-semibold">{labels[resultState] ?? resultState}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-xs text-muted-foreground">Tahap berikutnya</p>
                    <p className="mt-1 font-semibold">Persetujuan memorandum</p>
                  </div>
                </div>
              );
            })()}

            <section className="space-y-3">
              <div>
                <h3 className="font-semibold">Pilih kandidat</h3>
                <p className="text-xs text-muted-foreground">Hanya peserta lulus dengan penawaran aktif dan negosiasi terakhir disepakati.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {list(recommendationData?.candidates).map((candidate) => {
                  const vendor = candidate.vendor as RecordData | undefined;
                  const offer = candidate.penawaran as RecordData | undefined;
                  const latestNegotiation = offer?.latestNegotiation as RecordData | undefined;
                  const evaluationParticipant = selectionParticipants.find((participant) => String(participant.id) === String(candidate.id));
                  const evaluationCriteria = [
                    evaluationParticipant?.lulusAdministrasi,
                    evaluationParticipant?.lulusDokumen,
                    evaluationParticipant?.lulusTeknis,
                    evaluationParticipant?.lulusLegal,
                    evaluationParticipant?.lulusKomersial,
                    evaluationParticipant?.lulusDelivery,
                    evaluationParticipant?.lulusTerms,
                  ];
                  const passedCriteriaCount = evaluationCriteria.filter((passed) => passed === true).length;
                  const selectedCandidate = selectedRecommendationParticipant === String(candidate.id);
                  return (
                    <div key={String(candidate.id)} className={`rounded-lg border p-3 transition ${selectedCandidate ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40"}`}>
                      <button
                        type="button"
                        disabled={!recommendationData?.canVote}
                        aria-pressed={selectedCandidate}
                        onClick={() => setSelectedRecommendationParticipant(String(candidate.id))}
                        className="w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold">{vendor?.nama == null ? "Vendor" : String(vendor.nama)}</span>
                          <span className="rounded-full bg-muted px-2 py-1 text-xs">Peringkat {text(candidate.peringkat)}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>
                            Skor evaluasi: <strong className="text-foreground">{text(candidate.skor)}</strong>
                          </span>
                          <span>
                            Harga disepakati:{" "}
                            <strong className="text-foreground">
                              {offer?.mataUang == null ? "IDR" : String(offer.mataUang)} {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(Number(latestNegotiation?.hargaPenawaran ?? offer?.hargaPenawaran ?? 0))}
                            </strong>
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Lulus {passedCriteriaCount}/7 kriteria evaluasi · Negosiasi disepakati</p>
                      </button>
                      <div className="mt-3 flex justify-end border-t pt-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setRecommendationDetailId(String(candidate.id))}>
                          Lihat analisis kandidat
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {Boolean(recommendationData?.canVote) && (
              <label className="grid gap-2 text-sm font-medium" htmlFor="selection-recommendation">
                Alasan rekomendasi
                <textarea
                  id="selection-recommendation"
                  rows={4}
                  className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring/40"
                  value={recommendation}
                  onChange={(event) => setRecommendation(event.target.value)}
                  placeholder="Jelaskan pertimbangan harga, kualitas, kepastian pasok, waktu pengiriman, dan risiko."
                />
              </label>
            )}

            <section className="space-y-3">
              <div>
                <h3 className="font-semibold">Petugas rekomendasi</h3>
                <p className="text-xs text-muted-foreground">Jumlah petugas mengikuti assignment aktif tahap ini.</p>
              </div>
              <div className="divide-y rounded-lg border">
                {list(recommendationData?.assignments).map((assignment) => {
                  const assignmentUser = assignment.user as RecordData | undefined;
                  const assignmentName = assignmentUser?.nama ?? assignmentUser?.email ?? "Petugas";
                  return (
                    <div key={String(assignment.id)} className="flex items-center justify-between gap-3 p-3">
                      <span className="text-sm font-medium">{String(assignmentName)}</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${assignment.submitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{assignment.submitted ? "Sudah memilih" : "Belum memilih"}</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {list(recommendationData?.aggregate).length > 0 && (
              <section className="space-y-3">
                <h3 className="font-semibold">Rekap suara</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list(recommendationData?.aggregate).map((item) => (
                    <div key={String(item.pesertaId)} className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span>{(item.vendor as RecordData | undefined)?.nama == null ? "Vendor" : String((item.vendor as RecordData).nama)}</span>
                      <strong>{item.voteCount == null ? "0" : String(item.voteCount)} suara</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
              Peserta lain belum dieliminasi pada tahap ini. Status tidak terpilih baru diterapkan setelah memorandum pemenang disetujui final.
            </p>
          </div>
        )}
      </Modal>
      <Modal
        open={Boolean(recommendationDetailId)}
        onClose={() => setRecommendationDetailId("")}
        title="Analisis kandidat rekomendasi"
        description="Ringkasan kekuatan dan hal yang perlu dipertimbangkan dari data evaluasi, penawaran, negosiasi, dan dokumen."
        size="xl"
        contentClassName="max-h-[92dvh]"
        bodyClassName="space-y-5"
        footer={
          <Button variant="outline" onClick={() => setRecommendationDetailId("")}>
            Tutup
          </Button>
        }
      >
        {(() => {
          const candidate = list(recommendationData?.candidates).find((row) => String(row.id) === recommendationDetailId);
          if (!candidate) return <p className="text-sm text-muted-foreground">Data kandidat tidak tersedia.</p>;
          const candidateOfferSummary = candidate.penawaran as RecordData | undefined;
          const offer = list(detail.penawaran).find((row) => String(row.id) === String(candidateOfferSummary?.id)) ?? {};
          const participant = selectionParticipants.find((row) => String(row.id) === String(candidate.id));
          const baseline = asRecord(asRecord(offer.detail).rfqBaseline);
          const negotiation = candidateOfferSummary?.latestNegotiation as RecordData | undefined;
          const currency = String(candidateOfferSummary?.mataUang ?? offer.mataUang ?? "IDR");
          const initialPrice = Number(offer.hargaPenawaran);
          const finalPrice = Number(negotiation?.hargaPenawaran ?? offer.hargaPenawaran);
          const referencePrice = Number(participant?.nilaiHargaAcuan);
          const validFinalPrice = Number.isFinite(finalPrice);
          const priceChange = Number.isFinite(initialPrice) && initialPrice > 0 && validFinalPrice ? ((finalPrice - initialPrice) / initialPrice) * 100 : null;
          const referenceDifference = Number.isFinite(referencePrice) && referencePrice > 0 && Number.isFinite(initialPrice) ? ((initialPrice - referencePrice) / referencePrice) * 100 : null;
          const formatMoney = (value: unknown) => {
            const amount = Number(value);
            return value == null || value === "" || !Number.isFinite(amount) ? "—" : `${currency} ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(amount)}`;
          };
          const criteria = [
            ["Administrasi", participant?.lulusAdministrasi],
            ["Dokumen", participant?.lulusDokumen],
            ["Teknis", participant?.lulusTeknis],
            ["Legal", participant?.lulusLegal],
            ["Komersial", participant?.lulusKomersial],
            ["Delivery", participant?.lulusDelivery],
            ["Terms", participant?.lulusTerms],
          ] as Array<[string, boolean | undefined]>;
          const passed = criteria.filter(([, value]) => value === true).length;
          const uploads = list(offer.dokumenPenawaran);
          const requiredDocs = list(baseline.dokumenDiminta).filter((row) => row.wajib);
          const uploadedIds = new Set(uploads.map((row) => String(row.requirementId)));
          const missingDocuments = requiredDocs.filter((row) => !uploadedIds.has(String(row.id)));
          const verification = list(detail.verifikasi)
            .filter((row) => String(row.vendorId) === String(candidate.vendorId))
            .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
          const verificationLabel = ({ selesai: "Sesuai", revisi: "Perlu perbaikan", ditolak: "Tidak sesuai" } as Record<string, string>)[String(verification?.hasil)] ?? String(verification?.hasil ?? "Belum tercatat").replaceAll("_", " ");
          const strengths = [
            `${passed} dari ${criteria.length} kriteria evaluasi dinyatakan lulus.`,
            "Negosiasi terakhir berstatus disepakati.",
            priceChange != null && priceChange < 0 ? `Harga akhir turun ${Math.abs(priceChange).toFixed(2)}% dari penawaran awal.` : null,
            referenceDifference != null && referenceDifference <= 0 ? "Harga penawaran awal berada pada atau di bawah harga acuan." : null,
            requiredDocs.length > 0 && missingDocuments.length === 0 ? `Seluruh ${requiredDocs.length} dokumen wajib tercatat.` : null,
          ].filter((item): item is string => Boolean(item));
          const considerations = [
            referenceDifference != null && referenceDifference > 0 ? `Harga penawaran awal ${referenceDifference.toFixed(2)}% di atas harga acuan.` : null,
            priceChange != null && priceChange > 0 ? `Harga hasil negosiasi naik ${priceChange.toFixed(2)}% dari penawaran awal.` : null,
            missingDocuments.length ? `Dokumen wajib belum tertaut: ${missingDocuments.map((row) => String(row.nama ?? "Dokumen")).join(", ")}.` : null,
            verification?.hasil && verification.hasil !== "selesai" ? `Status verifikasi vendor: ${verificationLabel}.` : null,
            referenceDifference == null ? "Perbandingan dengan harga acuan tidak tersedia atau tidak dapat dihitung." : null,
          ].filter((item): item is string => Boolean(item));
          const costComponents = asRecord(participant?.komponenBiayaPerolehan);
          const componentLabels: Record<string, string> = {
            freight: "Pengangkutan / freight",
            asuransi: "Asuransi",
            kepelabuhanan: "Kepelabuhanan",
            penyimpanan: "Penyimpanan",
            pajakKepabeanan: "Pajak dan kepabeanan",
            inspeksi: "Inspeksi",
            pembiayaan: "Pembiayaan / perbankan",
            biayaLain: "Biaya langsung lain",
            diskon: "Diskon / kredit",
          };
          return (
            <div className="space-y-5">
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4">
                <div>
                  <p className="text-xs text-muted-foreground">Vendor kandidat</p>
                  <h3 className="text-lg font-semibold">{String((candidate.vendor as RecordData | undefined)?.nama ?? "Vendor")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {offer.nomorRfq ? `RFQ ${text(offer.nomorRfq)}` : "Penawaran aktif"} · Revisi {text(offer.revisi ?? 1)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-lg border bg-background px-3 py-2 text-sm">
                    Skor <strong>{text(candidate.skor)}</strong>
                  </span>
                  <span className="rounded-lg border bg-background px-3 py-2 text-sm">
                    Peringkat <strong>{text(candidate.peringkat)}</strong>
                  </span>
                  <span className="rounded-lg border bg-background px-3 py-2 text-sm">
                    Lulus{" "}
                    <strong>
                      {passed}/{criteria.length}
                    </strong>
                  </span>
                </div>
              </section>

              <section className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                  <h4 className="font-semibold text-emerald-900 dark:text-emerald-200">Kekuatan</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900 dark:text-emerald-100">
                    {strengths.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-200">Hal yang perlu dipertimbangkan</h4>
                  {considerations.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950 dark:text-amber-100">
                      {considerations.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-amber-950 dark:text-amber-100">Tidak ada indikator tambahan dari data harga, verifikasi, dan dokumen yang tercatat. Pertimbangkan juga catatan evaluasi dan kebutuhan operasional.</p>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border">
                <h4 className="border-b bg-muted/30 px-4 py-2 font-semibold">Hasil evaluasi</h4>
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {criteria.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                      <span>{label}</span>
                      <span className={value ? "font-medium text-emerald-700 dark:text-emerald-300" : "font-medium text-muted-foreground"}>{value ? "Lulus" : "Tidak lulus"}</span>
                    </div>
                  ))}
                </div>
                <dl className="grid gap-x-6 border-t px-4 sm:grid-cols-2">
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Status verifikasi</dt>
                    <dd className="font-medium">{verificationLabel}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Sumber harga acuan</dt>
                    <dd className="font-medium">{text(participant?.sumberHargaAcuan)}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Harga acuan per satuan</dt>
                    <dd className="font-medium">{formatMoney(participant?.nilaiHargaAcuan)}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Harga penawaran awal</dt>
                    <dd className="font-medium">{formatMoney(offer.hargaPenawaran)}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Harga hasil negosiasi</dt>
                    <dd className="font-medium">{formatMoney(negotiation?.hargaPenawaran)}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Total biaya perolehan</dt>
                    <dd className="font-medium">{formatMoney(negotiation?.totalBiayaPerolehan ?? candidate.totalBiayaPerolehanEvaluasi)}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Selisih dari harga acuan</dt>
                    <dd className="font-medium">{referenceDifference == null ? "—" : `${referenceDifference > 0 ? "+" : ""}${referenceDifference.toFixed(2)}%`}</dd>
                  </div>
                </dl>
              </section>

              <section className="overflow-hidden rounded-xl border">
                <h4 className="border-b bg-muted/30 px-4 py-2 font-semibold">Negosiasi terakhir</h4>
                <dl className="grid gap-x-6 px-4 sm:grid-cols-2">
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Putaran</dt>
                    <dd className="font-medium">{text(negotiation?.putaran)}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">{negotiationStatus(negotiation?.status ?? "")}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Tanggapan vendor</dt>
                    <dd className="font-medium">{text(negotiation?.tanggapanVendor)}</dd>
                  </div>
                  <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1fr)] gap-3 border-b py-2 text-sm">
                    <dt className="text-muted-foreground">Hasil / kesepakatan</dt>
                    <dd className="font-medium">{text(negotiation?.hasil)}</dd>
                  </div>
                </dl>
              </section>

              <section className="overflow-hidden rounded-xl border">
                <h4 className="border-b bg-muted/30 px-4 py-2 font-semibold">Kebutuhan dan dokumen</h4>
                <div className="space-y-3 p-4 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Volume RFQ:</span> <strong>{[text(baseline.volume), text(baseline.satuan)].filter(Boolean).join(" ") || "—"}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Titik serah:</span> <strong>{text(baseline.titikSerah)}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Syarat penyerahan:</span> <strong>{text(baseline.syaratPenyerahan)}</strong>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Syarat pembayaran:</span> <strong>{text(baseline.syaratPembayaran)}</strong>
                    </p>
                  </div>
                  {baseline.spesifikasi ? (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Spesifikasi</p>
                      <DetailValue value={baseline.spesifikasi} />
                    </div>
                  ) : null}
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Dokumen wajib ({requiredDocs.length - missingDocuments.length}/{requiredDocs.length} tercatat)
                    </p>
                    {requiredDocs.length ? (
                      <ul className="divide-y rounded-lg border px-3">
                        {requiredDocs.map((document) => {
                          const uploaded = uploads.find((item) => String(item.requirementId) === String(document.id));
                          const attached = uploaded?.dokumen ?? uploaded;
                          return (
                            <li key={String(document.id)} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <span>{String(document.nama ?? "Dokumen wajib")}</span>
                              <span className={attached ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}>{attached ? `Terunggah: ${String(attached.nama ?? "dokumen")}` : "Belum tertaut"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">Tidak ada dokumen wajib yang tercatat pada RFQ.</p>
                    )}
                  </div>
                </div>
              </section>

              {Object.keys(costComponents).length ? (
                <section className="overflow-hidden rounded-xl border">
                  <h4 className="border-b bg-muted/30 px-4 py-2 font-semibold">Rincian biaya perolehan evaluasi</h4>
                  <div className="divide-y px-4">
                    {Object.entries(costComponents).map(([key, raw]) => {
                      const component = asRecord(raw);
                      return (
                        <div key={key} className="grid gap-1 py-2 sm:grid-cols-[minmax(11rem,0.7fr)_minmax(0,1fr)] sm:gap-4">
                          <span className="text-muted-foreground">{componentLabels[key] ?? key}</span>
                          <span>
                            {formatMoney(component.nilai)}
                            {component.includedInOffer ? " · sudah termasuk harga penawaran" : ""}
                            {component.sumber ? ` · ${String(component.sumber)}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {participant?.alasan || participant?.catatanEvaluasi ? (
                <section className="overflow-hidden rounded-xl border">
                  <h4 className="border-b bg-muted/30 px-4 py-2 font-semibold">Catatan evaluasi</h4>
                  <div className="space-y-3 p-4">
                    {participant.alasan ? (
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Alasan</p>
                        <p className="mt-1 whitespace-pre-wrap">{String(participant.alasan)}</p>
                      </div>
                    ) : null}
                    {participant.catatanEvaluasi ? (
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Catatan</p>
                        <p className="mt-1 whitespace-pre-wrap">{String(participant.catatanEvaluasi)}</p>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                Gunakan rincian ini sebagai bahan pertimbangan dan tuliskan alasan pada suara Anda. Suara merupakan rekomendasi; penetapan pemenang tetap mengikuti memorandum dan persetujuan.
              </p>
            </div>
          );
        })()}
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
              const offerGroups = [
                { title: "Informasi penawaran", keys: ["vendorName", "mataUang", "hargaPenawaran", "berlakuSampai", "revisi", "status", "createdAt"] },
                { title: "Verifikasi dan evaluasi", keys: ["verification", "evaluationStatus", "kelulusan", "skor", "peringkat"] },
                { title: "Harga acuan dan biaya perolehan", keys: ["sumberHargaAcuan", "nilaiHargaAcuan", "totalBiayaPerolehanEvaluasi"] },
                { title: "Negosiasi", keys: ["negotiationCount", "negotiationStatus", "putaran", "batasNegosiasi", "hargaHasilNegosiasi", "totalBiayaPerolehan", "tanggapanVendor", "hasil"] },
                { title: "Kelengkapan dokumen", keys: ["documentStatus"] },
              ];
              const offerValueMap = new Map(scalarEntries);
              const renderScalarRows = (rows: Array<[string, unknown]>, compact = false) => (
                <dl className={compact ? "grid grid-cols-1 sm:grid-cols-2" : "overflow-hidden rounded-xl border bg-background"}>
                  {rows.map(([key, value], index) => (
                    <div
                      key={key}
                      className={
                        compact
                          ? `grid min-w-0 gap-1.5 border-b border-border/70 px-4 py-1.5 sm:grid-cols-[minmax(5.5rem,0.38fr)_minmax(0,1fr)] sm:gap-3 ${index % 2 === 1 ? "sm:border-l sm:pl-4" : ""}`
                          : `grid min-w-0 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(11rem,0.34fr)_minmax(0,1fr)] sm:gap-5 ${index > 0 ? "border-t border-border/70" : ""}`
                      }
                    >
                      <dt className="text-xs font-medium text-muted-foreground">{labelFor(key)}</dt>
                      <dd className="min-w-0 break-words text-sm font-medium leading-relaxed text-foreground">
                        <DetailValue value={value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              );
              return (
                <>
                  {!isOffer ? (
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
                  ) : null}
                  <section className={isOffer ? "space-y-3" : "space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"}>
                    {!isOffer ? (
                      <header className="flex items-end justify-between gap-3 border-b pb-3">
                        <div>
                          <h3 className="font-semibold tracking-tight">Informasi record</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Ringkasan data dan atribut utama.</p>
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">{isOffer ? "Ringkasan penawaran" : `${entries.length} field`}</span>
                      </header>
                    ) : null}
                    {isOffer ? (
                      <div className="overflow-hidden rounded-xl border bg-card">
                        {currentSelected.vendor ? (
                          <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-3">
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
                        {offerGroups.map((group) => {
                          const rows = group.keys.flatMap((key) => {
                            const value = offerValueMap.get(key);
                            return value === undefined ? [] : [[key, value] as [string, unknown]];
                          });
                          return rows.length ? (
                            <section key={group.title}>
                              <h4 className="border-b bg-muted/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h4>
                              {renderScalarRows(rows, true)}
                            </section>
                          ) : null;
                        })}
                        {scalarEntries.some(([key]) => !offerGroups.some((group) => group.keys.includes(key))) ? (
                          <section>
                            <h4 className="border-b bg-muted/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Informasi lainnya</h4>
                            {renderScalarRows(
                              scalarEntries.filter(([key]) => !offerGroups.some((group) => group.keys.includes(key))),
                              true,
                            )}
                          </section>
                        ) : null}
                        {offerDetail?.catatan ? (
                          <section className="border-t px-4 py-3">
                            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Catatan vendor</h4>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{String(offerDetail.catatan)}</p>
                          </section>
                        ) : null}
                      </div>
                    ) : scalarEntries.length ? (
                      renderScalarRows(scalarEntries)
                    ) : null}
                    {isOffer && Array.isArray(currentSelected.dokumenPenawaran) && currentSelected.dokumenPenawaran.length ? (
                      <section className="overflow-hidden rounded-xl border bg-card">
                        <h4 className="border-b bg-muted/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dokumen yang diunggah</h4>
                        <div className="space-y-1.5 px-4 py-2">
                          {currentSelected.dokumenPenawaran.map((item: Record<string, any>, index: number) => {
                            const doc = item.dokumen ?? item;
                            return (
                              <div key={String(doc.id ?? index)} className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-b-0">
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
                      <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">Belum ada dokumen yang diunggah untuk penawaran ini.</p>
                    ) : null}
                    {rfqBaseline ? (
                      <section className="overflow-hidden rounded-xl border bg-card">
                        <h4 className="border-b bg-muted/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Acuan kebutuhan RFQ</h4>
                        <div className="space-y-3 px-4 py-3">
                          <dl className="overflow-hidden">
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
                              .map(([key, label], index) => (
                                <div key={key} className={`grid min-w-0 gap-1.5 px-0 py-2 sm:grid-cols-[minmax(9rem,0.32fr)_minmax(0,1fr)] sm:gap-4 ${index > 0 ? "border-t border-border/70" : ""}`}>
                                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                                  <dd className="min-w-0 whitespace-pre-wrap break-words text-sm">{typeof rfqBaseline[key] === "object" ? <DetailValue value={rfqBaseline[key]} /> : String(rfqBaseline[key])}</dd>
                                </div>
                              ))}
                          </dl>
                          {rfqBaseline.spesifikasi ? (
                            <div>
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Spesifikasi</p>
                              <DetailValue value={rfqBaseline.spesifikasi} />
                            </div>
                          ) : null}
                          {Array.isArray(rfqBaseline.dokumenDiminta) && rfqBaseline.dokumenDiminta.length ? (
                            <div>
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Dokumen diminta</p>
                              <div className="space-y-1.5">
                                {rfqBaseline.dokumenDiminta.map((document: Record<string, unknown>, index: number) => {
                                  const attachedDocument = list(currentSelected.dokumenPenawaran).find((item) => String(item.requirementId) === String(document.id));
                                  const uploadedFile = attachedDocument?.dokumen ?? attachedDocument;
                                  return (
                                    <div key={String(document.id ?? index)} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 first:border-t-0">
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
