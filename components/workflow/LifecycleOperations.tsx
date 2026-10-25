"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Ban, Check, ClipboardList, FileCheck2, FileText, Handshake, Send, Settings2, Ship, Wallet, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { browserApi } from "@/lib/api/browser-client";
import { ContentType } from "@/lib/api/generated/api-generated";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { getApiErrorMessage } from "@/lib/api/errors";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { procurementMethodLabel } from "@/lib/procurement-methods";
import { lifecycleOperations, operationPayload, type Entity, type Field, type Operation } from "./lifecycle-operations-config";

export type LifecycleOperationsProps = { pengadaanId: string; stage: string; active: boolean; detail: any };
type Choice = { value: string; label: string };
function object(value: unknown): Entity {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Entity) : {};
}
function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && "data" in current; depth++) current = (current as Entity).data;
  return current;
}
function records(value: unknown): Entity[] {
  return Array.isArray(value) ? value.map(object) : [];
}
function parseParameterRows(value: string): Array<{ name: string; value: string }> {
  const rows = value
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const separator = line.indexOf(":");
      return separator < 0 ? { name: line.trim(), value: "" } : { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
  return rows.length ? rows : [{ name: "", value: "" }];
}
function serializeParameterRows(rows: Array<{ name: string; value: string }>): string {
  return rows.map((row) => `${row.name}: ${row.value}`).join("\n");
}
function normalizedTerm(terms: Entity, key: string): unknown {
  const value = terms[key];
  const nested = object(value);
  return Object.prototype.hasOwnProperty.call(nested, key) ? nested[key] : value;
}
function parameterText(value: unknown): string {
  const entries = Object.entries(object(value));
  return entries.map(([name, item]) => `${name}: ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
}
function documentRequirementText(value: unknown): string {
  if (!Array.isArray(value)) return parameterText(value);
  return value
    .map((entry) => {
      const document = object(entry);
      const name = plainText(document.nama);
      const details = [document.wajib ? "Wajib" : "Opsional", plainText(document.keterangan)].filter((detail) => detail && detail !== "—").join("; ");
      return name ? `${name}: ${details}` : "";
    })
    .filter(Boolean)
    .join("\n");
}
function plainText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value == null) return "";
  const entries = Object.entries(object(value));
  if (entries.length === 1 && typeof entries[0][1] === "string") return entries[0][1] as string;
  return JSON.stringify(value);
}
function cleanParameterRows(value: string): string {
  return parseParameterRows(value)
    .filter((row) => row.name.trim() || row.value.trim())
    .map((row) => `${row.name}: ${row.value}`)
    .join("\n");
}
function choices(rows: Entity[]): Choice[] {
  return rows.filter((row) => typeof row.id === "string").map((row) => ({ value: String(row.id), label: [row.nomor ?? row.nama ?? row.namaKapal ?? row.nomorBillOfLading ?? row.jenis ?? row.id].filter(Boolean).join(" · ") }));
}
function operationFieldSections(operationKey: string | undefined, fields: Field[]): Array<{ title: string; fields: Field[] }> {
  const sections: Record<string, { title: string; fields: string[] }[]> = {
    rfq: [
      { title: "Informasi RFQ", fields: ["mode", "vendorIds", "rfqId", "rfqIds", "nomor", "alasanPerubahan", "batasRespons"] },
      { title: "Kebutuhan dan ketentuan", fields: ["spesifikasi", "volume", "satuan", "titikSerah", "syaratPenyerahan", "syaratPembayaran", "dokumenDiminta"] },
    ],
    perencanaan: [
      { title: "Informasi kebutuhan", fields: ["modelPelaksanaan", "jenisKargo", "satuan", "titikSerah", "nomorPenugasan", "penerimaPasokan"] },
      { title: "Spesifikasi dan kesiapan penerima", fields: ["spesifikasiMutu", "kesiapanPenerima"] },
      { title: "Volume dan jadwal", fields: ["volumeMin", "volumeMax", "estimasiMulai", "estimasiSelesai"] },
    ],
    strategi: [
      { title: "Metode transaksi", fields: ["jenisTransaksi", "metodeSeleksi"] },
      { title: "Analisis dan strategi", fields: ["analisisPasar", "dasarPemilihan", "strategiPengiriman", "strategiPembiayaan"] },
    ],
    negosiasi: [{ title: "Detail negosiasi", fields: ["penawaranId", "batasNegosiasi", "hargaHasilNegosiasi", "hasil"] }],
  };
  const configured = sections[operationKey ?? ""];
  if (!configured) return [{ title: "Informasi", fields }];
  const grouped = configured.map((section) => ({ title: section.title, fields: fields.filter((field) => section.fields.includes(field.name)) })).filter((section) => section.fields.length);
  const assigned = new Set(grouped.flatMap((section) => section.fields.map((field) => field.name)));
  const remaining = fields.filter((field) => !assigned.has(field.name));
  if (remaining.length) grouped.push({ title: "Informasi tambahan", fields: remaining });
  return grouped;
}

/** Standalone: parent supplies unwrapped GET siklus detail; mutations invalidate lifecycle and related lists. */
export function LifecycleOperations(props: LifecycleOperationsProps) {
  // Changing procurement/stage clears form state, without leaking previous IDs or success messages.
  return <OperationsPanel key={`${props.pengadaanId}:${props.stage}`} {...props} />;
}

function OperationsPanel({ pengadaanId, stage, active, detail: rawDetail }: LifecycleOperationsProps) {
  const detail = object(unwrap(rawDetail));
  const user = useCurrentUser();
  const currentUser = object(unwrap(user.data));
  const role = String(currentUser.role ?? "").toLowerCase();
  const isAssignedMember =
    role !== "member" || records(detail.tahapan).some((row) => String(row.tahap) === stage && records(row.assignments).some((assignment) => String(assignment.userId ?? object(assignment.user).id) === String(currentUser.id)));
  const id = useId();
  const [selected, setSelected] = useState<Operation | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [closingNegotiation, setClosingNegotiation] = useState<Entity | null>(null);
  const [closingReason, setClosingReason] = useState("");
  const [selectedNegotiationId, setSelectedNegotiationId] = useState("");
  const submitting = useRef(false);
  const revisionSeedKey = useRef("");
  const uninitialized = stage === "perencanaan" && Array.isArray(detail.tahapan) && detail.tahapan.length === 0;
  const isPublicDirectPurchase = String(detail.metode) === "pengadaan_langsung";
  const latestNegotiations: Entity[] = records(detail.penawaran).flatMap((offer) => {
    const latest = [...records(offer.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0];
    return latest ? [{ ...latest, penawaranId: offer.id, vendor: offer.vendor }] : [];
  });
  const passedVendorIds = new Set(
    records(object(detail.pemilihanPenyedia).peserta)
      .filter((participant) => participant.status === "lulus")
      .map((participant) => String(participant.vendorId ?? object(participant.vendor).id ?? "")),
  );
  const startableOffers = records(detail.penawaran).filter((offer) => {
    const latest = [...records(offer.negosi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0];
    return offer.isCurrent !== false && !!offer.submittedAt && passedVendorIds.has(String(offer.vendorId ?? object(offer.vendor).id ?? "")) && (!latest || latest.status === "ditolak");
  });
  const chosenNegotiation = latestNegotiations.find((row) => String(row.id) === selectedNegotiationId) ?? null;
  const chosenContinuation = chosenNegotiation?.status === "ditolak" ? chosenNegotiation : undefined;
  const available = lifecycleOperations.filter(
    (op) => op.stages.includes(stage) && op.roles.includes(role) && (op.key !== "verifikasi" || role !== "member" || isAssignedMember) && (!uninitialized || op.key === "perencanaan") && (!op.available || op.available(detail)),
  );
  const canManageRecommendation = active && stage === "rekomendasi_pemenang" && ["admin", "operator", "verifikator", "member"].includes(role) && (role !== "member" || isAssignedMember);
  const fields =
    selected?.fields
      .filter((field) => {
        if (role === "vendor" && field.name === "vendorId") return false;
        if (selected.key === "tutupRfq" || selected.key === "bukaKembaliRfq") return false;
        if (selected.key === "rfq" && isPublicDirectPurchase) return !["mode", "vendorIds", "rfqId", "rfqIds", "alasanPerubahan"].includes(field.name);
        if (selected.key !== "rfq") return true;
        const mode = values.mode || "baru";
        if (mode === "baru") return field.name !== "rfqId" && field.name !== "alasanPerubahan";
        if (mode === "tambah_vendor") return ["mode", "rfqId", "vendorIds"].includes(field.name);
        return field.name !== "vendorIds";
      })
      .map((field) => (selected?.key === "rfq" && field.name === "rfqId" && values.mode === "revisi" ? { ...field, name: "rfqIds", label: "RFQ acuan (pilih satu atau beberapa)", multiple: true, required: true } : field)) ?? [];
  const needsVendors = !!selected && fields.some((field) => field.relation === "vendor");
  const vendors = use_query<Entity[], Error, string>({
    tag: "vendor",
    method: "lifecycleOperationsVendors",
    params: "all",
    enabled: needsVendors && active,
    queryFn: async () => {
      setBrowserToken();
      const result = new Map<string, Entity>();
      for (let page = 1; ; page++) {
        const raw = await apiData(browserApi.vendor.vendorGetControllerFindAll({ page, limit: 100 }, { format: "json" }) as unknown as Promise<{ data: unknown }>);
        let envelope = object(raw);
        // Preserve pagination when legacy transport adds another data wrapper.
        if (!Array.isArray(envelope.data) && object(envelope.data).pagination) envelope = object(envelope.data);
        const rows = records(unwrap(envelope));
        for (const row of rows) if (typeof row.id === "string") result.set(row.id, row);
        const totalPages = Number(object(envelope.pagination).total_pages);
        if ((Number.isFinite(totalPages) && page >= totalPages) || rows.length < 100) break;
        if (page >= 1000) throw new Error("Daftar vendor terlalu besar. Hubungi admin untuk memeriksa paginasi.");
      }
      return [...result.values()];
    },
  });
  const options = (field: Field): Choice[] => {
    if (field.relation === "vendor") {
      const related = ["rfq", "penawaran", "verifikasi", "kontrak"].flatMap((key) => records(detail[key]).map((row) => object(row.vendor)));
      // Full directory remains source of status; detail-only rows fill gaps, never replace fetched rows.
      const all = new Map<string, Entity>();
      for (const row of [...related, ...(vendors.data ?? [])]) if (typeof row.id === "string") all.set(row.id, row);
      const winnerId = String(object(detail.pemilihanPenyedia).vendorTerpilihId ?? "");
      const winnerApproved = object(detail.pemilihanPenyedia).status === "disetujui";
      const biddingVendorIds = new Set(
        records(detail.penawaran)
          .filter((offer) => offer.isCurrent !== false && offer.submittedAt)
          .map((offer) => String(offer.vendorId)),
      );
      return choices(
        [...all.values()].filter(
          (row) =>
            (selected?.key !== "penawaran" || row.status === "aktif") &&
            (selected?.key !== "verifikasi" || biddingVendorIds.has(String(row.id))) &&
            (selected?.key !== "kontrak" || !winnerApproved || !winnerId || String(row.id) === winnerId),
        ),
      );
    }
    if (field.relation === "penawaran" && selected?.key === "negosiasi") {
      return startableOffers
        .map((offer) => {
          const vendorName = plainText(object(offer.vendor).nama) || "Vendor";
          const rfqNumber = plainText(offer.nomorRfq) || plainText(object(offer.rfq).nomor);
          const revision = offer.revisi == null ? "R1" : `R${String(offer.revisi)}`;
          const unit = plainText(object(object(offer.detail).rfqBaseline).satuan);
          const amount = offer.hargaPenawaran == null ? "" : `${plainText(offer.mataUang)} ${String(offer.hargaPenawaran)}${unit ? ` / ${unit}` : ""}`.trim();
          return {
            value: String(offer.id ?? ""),
            label: [vendorName, rfqNumber ? `RFQ ${rfqNumber}` : "Penawaran", revision, amount].filter(Boolean).join(" · "),
          };
        })
        .filter((choice) => choice.value);
    }
    if (field.relation === "rfqAktif" || field.relation === "rfqTertutup") {
      const rows = records(detail.rfq).filter((row) => row.status === (field.relation === "rfqAktif" ? "aktif" : "selesai"));
      const unique = new Map<string, Entity>();
      for (const row of rows) {
        const key = String(row.kelompokId ?? row.id ?? "");
        const current = unique.get(key);
        if (!current || Number(row.revisi ?? 1) > Number(current.revisi ?? 1)) unique.set(key, row);
      }
      return [...unique.values()].map((row) => ({
        value: String(row.id ?? ""),
        label: row.isPublic ? `${String(row.nomor ?? "RFQ")} · RFQ publik · R${String(row.revisi ?? 1)}` : `${String(row.nomor ?? "RFQ")} · ${String(object(row.vendor).nama ?? "vendor")} · R${String(row.revisi ?? 1)}`,
      }));
    }
    if (field.relation) return choices(field.relation === "laporanDraft" ? records(detail.laporan).filter((row) => row.status === "draft") : records(detail[field.relation]));
    if (field.kind === "boolean")
      return [
        { value: "true", label: "Ya" },
        { value: "false", label: "Tidak" },
      ];
    return (field.options ?? []).map((value) => ({
      value,
      label: selected?.key === "verifikasi" && ["selesai", "ditolak", "revisi"].includes(value) ? ({ selesai: "Sesuai", ditolak: "Tidak sesuai", revisi: "Perlu perbaikan" } as Record<string, string>)[value] : value.replaceAll("_", " "),
    }));
  };
  const mutation = use_mutation<unknown, Error, { operation: Operation; body: Entity }>({
    tag: "siklusTransaksiKomoditas",
    method: "lifecycleBusinessOperation",
    invalidateKeys: [
      apiQueryKeys.resource("siklusTransaksiKomoditas"),
      apiQueryKeys.resource("lifecycleHistory"),
      apiQueryKeys.resource("lifecycleEvidence"),
      apiQueryKeys.resource("pengadaan"),
      apiQueryKeys.resource("approval"),
      apiQueryKeys.resource("dashboard"),
    ],
    mutationFn: async ({ operation, body }) => {
      setBrowserToken();
      return apiData(operation.run(pengadaanId, body) as Promise<{ data: unknown }>);
    },
  });
  const closeMutation = use_mutation<unknown, Error, { id: string; alasan: string }>({
    tag: "siklusTransaksiKomoditas",
    method: "closeNegotiation",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("pengadaan"), apiQueryKeys.resource("dashboard")],
    mutationFn: async ({ id, alasan }) => {
      setBrowserToken();
      return apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/negosiasi/${encodeURIComponent(id)}/akhiri`,
          method: "POST",
          body: { alasan },
          type: ContentType.Json,
          format: "json",
          secure: true,
        }) as Promise<{ data: unknown }>,
      );
    },
  });
  const locked = mutation.isPending || closeMutation.isPending || submitting.current;
  const permitted = !!selected && active && available.some((op) => op.key === selected.key);
  const vendorBlocked = needsVendors && (vendors.isPending || vendors.isError);
  const missingRelation = fields.some((field) => field.required && field.relation && !options(field).length);
  useEffect(() => {
    if (selected?.key !== "rfq" || values.mode !== "revisi") {
      revisionSeedKey.current = "";
      return;
    }
    const ids = (values.rfqIds ?? "").split(",").filter(Boolean);
    const key = ids.join(",");
    if (!ids.length || key === revisionSeedKey.current) return;
    revisionSeedKey.current = key;
    const rfq = records(detail.rfq).find((row) => row.id === ids[0]);
    if (!rfq) return;
    const terms = object(rfq.ketentuan);
    const canonical = (key: string) => rfq[key] ?? normalizedTerm(terms, key);
    setValues((current) => ({
      ...current,
      nomor: String(rfq.nomor ?? "").replace(/-R\d+$/, ""),
      batasRespons: rfq.batasRespons ? String(rfq.batasRespons).slice(0, 10) : "",
      spesifikasi: parameterText(canonical("spesifikasi")),
      volume: plainText(canonical("volume")),
      satuan: plainText(canonical("satuan")),
      titikSerah: plainText(canonical("titikSerah")),
      syaratPenyerahan: plainText(canonical("syaratPenyerahan")),
      syaratPembayaran: plainText(canonical("syaratPembayaran")),
      dokumenDiminta: documentRequirementText(canonical("dokumenDiminta")),
    }));
  }, [detail.rfq, selected?.key, values.mode, values.rfqIds]);
  function open(operation: Operation, negotiation?: Entity) {
    if (locked || !active) return;
    const continuation = negotiation ?? (operation.key === "negosiasi" ? chosenContinuation : undefined);
    const initial: Record<string, string> = operation.key === "rfq" ? { mode: "baru" } : {};
    if (operation.key === "negosiasi" && continuation) {
      initial.penawaranId = String(continuation.penawaranId ?? "");
      initial.batasNegosiasi = continuation.batasNegosiasi == null ? "" : String(continuation.batasNegosiasi);
      initial.hargaHasilNegosiasi = continuation.hargaHasilNegosiasi == null ? "" : String(continuation.hargaHasilNegosiasi);
      initial.hasil = continuation.hasil == null ? "" : String(continuation.hasil);
    }
    const seed = object(operation.seed ? detail[operation.seed] : null);
    for (const field of operation.fields) {
      const value = seed[field.name];
      const seedValue = field.payloadPath ? field.payloadPath.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Entity)[key] : undefined), seed) : value;
      if (seedValue == null) continue;
      initial[field.name] =
        field.kind === "json" && typeof seedValue === "object" && seedValue !== null
          ? Object.entries(seedValue as Record<string, unknown>)
              .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
              .join("\n")
          : field.kind === "date"
            ? String(seedValue).slice(0, 10)
            : String(seedValue);
    }
    if (operation.key === "kontrak") {
      const selection = object(detail.pemilihanPenyedia);
      if (selection.status === "disetujui" && typeof selection.vendorTerpilihId === "string") initial.vendorId = selection.vendorTerpilihId;
    }
    revisionSeedKey.current = "";
    setValues(initial);
    setSelected(continuation ? { ...operation, title: "Buat Putaran Lanjutan" } : operation);
    setError("");
    setSuccess("");
    mutation.reset();
  }
  function close() {
    if (submitting.current || mutation.isPending) return;
    setSelected(null);
    setError("");
    mutation.reset();
  }
  async function submitClosing(event: React.FormEvent) {
    event.preventDefault();
    if (!closingNegotiation || locked || !closingReason.trim()) return;
    setError("");
    try {
      await closeMutation.mutateAsync({ id: String(closingNegotiation.id), alasan: closingReason.trim() });
      setSuccess("Negosiasi diakhiri tanpa kesepakatan.");
      setClosingNegotiation(null);
      setClosingReason("");
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || mutation.isPending || !permitted || vendorBlocked || missingRelation || !selected) return;
    setError("");
    setSuccess("");
    try {
      if (selected.key === "rfq") {
        if (values.mode === "tambah_vendor" && !values.rfqId) throw new Error("Pilih RFQ acuan untuk tambah vendor.");
        if (values.mode === "revisi" && !(values.rfqIds ?? "").split(",").filter(Boolean).length) throw new Error("Pilih minimal satu RFQ acuan untuk direvisi.");
        if (values.mode === "revisi" && !values.alasanPerubahan?.trim()) throw new Error("Alasan revisi wajib diisi.");
      }
      const payloadValues = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, fields.find((field) => field.name === name)?.kind === "json" ? cleanParameterRows(value) : value]));
      const body = operationPayload(fields, payloadValues, options);
      submitting.current = true;
      await mutation.mutateAsync({ operation: selected, body });
      setSuccess(
        selected.key === "rfq"
          ? isPublicDirectPurchase
            ? "RFQ publik berhasil diterbitkan. Vendor yang telah disetujui dapat mengirim penawaran hingga batas respons."
            : `RFQ berhasil diterbitkan kepada ${(body.vendorIds as string[] | undefined)?.length ?? 1} vendor.`
          : `${selected.title}: berhasil.`,
      );
      setSelected(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      submitting.current = false;
    }
  }
  const operationPresentation: Record<string, { description: string; icon: typeof ClipboardList }> = {
    perencanaan: { description: "Catat kebutuhan transaksi dan jadwal pengadaan.", icon: ClipboardList },
    strategi: { description: "Tentukan metode seleksi dan pendekatan transaksi.", icon: Settings2 },
    rfq: { description: isPublicDirectPurchase ? "Terbitkan RFQ publik untuk vendor yang telah disetujui." : "Kirim atau perbarui permintaan penawaran kepada vendor.", icon: Send },
    tutupRfq: { description: "Akhiri penerimaan penawaran untuk RFQ aktif.", icon: FileCheck2 },
    bukaKembaliRfq: { description: "Aktifkan kembali RFQ yang telah ditutup.", icon: FileText },
    verifikasi: { description: "Periksa legalitas, kepatuhan, dan rekening vendor.", icon: FileCheck2 },
    negosiasi: { description: "Pilih penawaran lulus evaluasi. Sistem menentukan nomor putaran dan memakai biaya perolehan hasil evaluasi.", icon: Handshake },
    memorandum: { description: "Susun rekomendasi transaksi untuk persetujuan.", icon: FileText },
    kontrak: { description: "Catat kesepakatan dan dokumen kontrak.", icon: FileCheck2 },
    pengiriman: { description: "Pantau pengapalan dan status pengiriman kargo.", icon: Ship },
    tagihan: { description: "Kelola tagihan, pembayaran, dan rekonsiliasi.", icon: Wallet },
  };
  return (
    <section className="space-y-4" aria-label="Operasi bisnis tahap">
      {canManageRecommendation ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">Pilih peserta lulus sebagai pemenang rekomendasi sebelum memorandum.</p>
          <Button size="sm" onClick={() => window.dispatchEvent(new Event("lifecycle:open-recommendation"))}>
            Kelola rekomendasi
          </Button>
        </div>
      ) : null}
      {user.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(user.error)}</AlertDescription>
        </Alert>
      ) : null}
      {!active ? <p className="text-sm text-muted-foreground">Operasi dinonaktifkan: tahap ini tidak aktif.</p> : null}
      {active && !user.isPending && !user.isError && !available.length && !canManageRecommendation ? (
        <p className="rounded-lg border border-dashed bg-background px-4 py-5 text-center text-sm text-muted-foreground">Belum ada operasi yang tersedia untuk peran atau status saat ini.</p>
      ) : null}
      <div className="space-y-4">
        {available
          // Keep manual offer-entry operation configured for future use, but hide it from current workflow.
          .filter((operation) => !["tutupRfq", "bukaKembaliRfq", "penawaran"].includes(operation.key))
          .map((operation) => {
            if (operation.key === "negosiasi") {
              const activeNegotiations = latestNegotiations;
              const selectedNegotiation = chosenNegotiation ?? activeNegotiations[0] ?? null;
              const selectedOffer = records(detail.penawaran).find((offer) => String(offer.id) === String(selectedNegotiation?.penawaranId));
              const selectedLatest = selectedOffer ? [...records(selectedOffer.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0] : null;
              const canContinue = selectedNegotiation?.status === "ditolak";
              const presentation = operationPresentation.negosiasi;
              const Icon = presentation.icon;
              return (
                <div key={operation.key} className="space-y-3">
                  {startableOffers.length ? (
                    <div className="flex justify-end">
                      <Button type="button" disabled={!active || locked} onClick={() => open(operation)}>
                        <Handshake size={16} /> Catat negosiasi
                      </Button>
                    </div>
                  ) : null}
                  <section className="overflow-hidden rounded-xl border bg-background">
                    <header className="flex items-start gap-3 border-b bg-muted/20 p-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">Kelola negosiasi</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Semua vendor dan status negosiasi terbaru tercantum di sini. Mulai negosiasi baru untuk vendor eligible lain tanpa menghapus riwayat ini.</p>
                      </div>
                    </header>
                    {activeNegotiations.length ? (
                      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                        <div className="max-h-72 space-y-2 overflow-y-auto p-3" role="listbox" aria-label="Pilih negosiasi">
                          {activeNegotiations.map((negotiation) => {
                            const isSelected = String(selectedNegotiation?.id) === String(negotiation.id);
                            const offer = records(detail.penawaran).find((row) => String(row.id) === String(negotiation.penawaranId));
                            const statusLabels: Record<string, string> = {
                              menunggu_tanggapan: "Menunggu tanggapan",
                              ditolak: "Ditolak vendor",
                              disepakati: "Disepakati",
                            };
                            const statusLabel = statusLabels[String(negotiation.status)] ?? String(negotiation.status ?? "Status tidak diketahui");
                            const statusStyle =
                              negotiation.status === "ditolak"
                                ? "bg-destructive/10 text-destructive"
                                : negotiation.status === "disepakati"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
                            return (
                              <button
                                key={String(negotiation.id)}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                disabled={!active || locked}
                                onClick={() => setSelectedNegotiationId(String(negotiation.id))}
                                className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${isSelected ? "border-primary bg-primary/[0.04] shadow-sm" : "hover:border-primary/30 hover:bg-muted/30"}`}
                              >
                                <span className="flex items-start justify-between gap-2">
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">{plainText(object(offer?.vendor).nama) || "Vendor"}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      RFQ {plainText(offer?.nomorRfq) || "—"} · Putaran {String(negotiation.putaran)}
                                    </span>
                                  </span>
                                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusStyle}`}>{statusLabel}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-col justify-between gap-4 border-t bg-muted/10 p-4 md:border-l md:border-t-0">
                          {selectedNegotiation ? (
                            <>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pilihan saat ini</p>
                                <h4 className="mt-1 font-semibold">{plainText(object(selectedOffer?.vendor).nama) || "Vendor"}</h4>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Putaran {String(selectedNegotiation.putaran)} · {selectedNegotiation.status === "ditolak" ? "Vendor menolak usulan" : "Menunggu tanggapan vendor"}
                                </p>
                                {selectedLatest?.hargaHasilNegosiasi != null ? (
                                  <p className="mt-2 text-sm">
                                    Harga terakhir:{" "}
                                    <strong>
                                      {plainText(object(selectedOffer).mataUang)} {String(selectedLatest.hargaHasilNegosiasi)}
                                    </strong>
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                  {canContinue
                                    ? "Vendor menolak usulan. Buat putaran lanjutan, atau mulai negosiasi dengan vendor lain."
                                    : selectedNegotiation.status === "disepakati"
                                      ? "Negosiasi dengan vendor ini berhasil disepakati."
                                      : "Putaran ini masih menunggu jawaban vendor. Anda tetap dapat memulai negosiasi dengan vendor lain."}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {canContinue ? (
                                  <Button type="button" disabled={!active || locked} onClick={() => open(operation, selectedNegotiation)}>
                                    <Handshake size={16} /> Buat putaran lanjutan
                                  </Button>
                                ) : null}
                                {selectedNegotiation.status !== "disepakati" ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-destructive/30 text-destructive hover:bg-destructive/5"
                                    disabled={!active || locked}
                                    onClick={() => {
                                      setClosingNegotiation(selectedNegotiation);
                                      setClosingReason("");
                                      setError("");
                                    }}
                                  >
                                    <Ban size={16} /> Akhiri tanpa kesepakatan
                                  </Button>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada riwayat negosiasi. Mulai negosiasi dengan vendor yang lulus evaluasi.</div>
                      </div>
                    )}
                  </section>
                </div>
              );
            }
            const presentation = operationPresentation[operation.key];
            const Icon = presentation?.icon ?? ClipboardList;
            return (
              <button
                key={operation.key}
                type="button"
                disabled={!active || locked}
                onClick={() => open(operation)}
                className="group flex min-h-[88px] w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{operation.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{presentation?.description ?? "Perbarui informasi transaksi pada tahap ini."}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </button>
            );
          })}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      <Modal
        open={!!closingNegotiation}
        onClose={() => !locked && setClosingNegotiation(null)}
        title="Akhiri Negosiasi Tanpa Kesepakatan"
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" disabled={locked} onClick={() => setClosingNegotiation(null)}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" form={`${id}-close-negotiation`} disabled={locked || !closingReason.trim()}>
              {closeMutation.isPending ? "Mengakhiri…" : "Akhiri negosiasi"}
            </Button>
          </>
        }
      >
        <form id={`${id}-close-negotiation`} onSubmit={submitClosing} className="space-y-3">
          <p className="text-sm text-muted-foreground">Tindakan menutup putaran terbaru. Vendor tidak dapat memberi tanggapan atau menerima putaran lanjutan.</p>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-closing-reason`}>Alasan penutupan *</Label>
            <textarea id={`${id}-closing-reason`} value={closingReason} onChange={(event) => setClosingReason(event.target.value)} maxLength={4000} rows={4} required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
        </form>
      </Modal>
      <Modal
        open={!!selected}
        onClose={close}
        title={selected?.title ?? "Operasi transaksi"}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" disabled={locked} onClick={close}>
              Batal
            </Button>
            <Button type="submit" form={`${id}-form`} disabled={locked || !permitted || vendorBlocked || missingRelation}>
              {locked ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form id={`${id}-form`} onSubmit={submit} className="space-y-4 px-1" aria-busy={locked}>
          {!permitted && selected ? (
            <Alert variant="destructive">
              <AlertDescription>Peran, status, atau tahap berubah. Operasi tidak tersedia.</AlertDescription>
            </Alert>
          ) : null}
          {vendorBlocked ? (
            <Alert variant={vendors.isError ? "destructive" : "default"}>
              <AlertDescription>
                {vendors.isError ? getApiErrorMessage(vendors.error) : "Memuat seluruh vendor…"}
                {vendors.isError ? (
                  <Button type="button" variant="link" onClick={() => void vendors.refetch()}>
                    Coba lagi
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {missingRelation && !vendorBlocked ? (
            <Alert>
              <AlertDescription>Relasi wajib belum tersedia. Buat catatan terkait terlebih dahulu.</AlertDescription>
            </Alert>
          ) : null}
          {!fields.length && selected?.key === "submit-memorandum" ? (
            <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4" aria-label="Ringkasan pengajuan memorandum">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Siap diajukan</p>
                <h3 className="mt-1 text-base font-semibold">Konfirmasi pengajuan memorandum</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Memorandum yang tersimpan akan dikirim ke alur review. Setelah diajukan, isinya terkunci sampai reviewer meminta revisi.</p>
              </div>
              <dl className="grid gap-3 rounded-lg border bg-background p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Status memorandum</dt>
                  <dd className="mt-1 font-medium">{plainText(object(detail.memorandum).status).replaceAll("_", " ") || "Draft"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Vendor rekomendasi</dt>
                  <dd className="mt-1 font-medium">{plainText(object(object(detail.pemilihanPenyedia).vendorTerpilih).nama) || "Belum ditetapkan"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Metode seleksi</dt>
                  <dd className="mt-1 font-medium">{procurementMethodLabel(plainText(object(detail.strategi).metodeSeleksi) || plainText(detail.metode))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status rekomendasi</dt>
                  <dd className="mt-1 font-medium">{plainText(object(detail.pemilihanPenyedia).status).replaceAll("_", " ") || "Belum direkomendasikan"}</dd>
                </div>
              </dl>
              <p className="text-xs leading-5 text-muted-foreground">Pengajuan membuat tiga tahap approval: Review Memorandum, Verifikasi Memorandum, lalu Persetujuan Pimpinan.</p>
            </section>
          ) : null}
          {!fields.length && selected?.key !== "submit-memorandum" ? <p>Konfirmasi {selected?.title.toLowerCase()} untuk pengadaan ini.</p> : null}
          {selected?.key === "memorandum"
            ? (() => {
                const strategy = object(detail.strategi);
                const selection = object(detail.pemilihanPenyedia);
                const winnerId = String(selection.vendorTerpilihId ?? "");
                const participant = records(selection.peserta).find((row) => String(row.vendorId) === winnerId);
                const offer = records(detail.penawaran).find((row) => String(row.id) === String(participant?.penawaranId ?? ""));
                const negotiation = [...records(offer?.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0];
                const assignments = records(detail.tahapan).find((row) => row.tahap === "rekomendasi_pemenang");
                const votes = records(selection.votes);
                const amount = (value: unknown, currency = "") => {
                  if (value == null || value === "") return "—";
                  const number = Number(value);
                  return [currency, Number.isFinite(number) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(number) : String(value)].filter(Boolean).join(" ");
                };
                return (
                  <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4" aria-label="Bukti rekomendasi sistem">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Keputusan hulu · hanya baca</p>
                      <h3 className="mt-1 font-semibold">{plainText(object(selection.vendorTerpilih).nama) || "Vendor rekomendasi belum tersedia"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Metode dan vendor ditetapkan dari strategi serta rekomendasi kolektif. Form tidak dapat menggantinya.</p>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Metode seleksi</dt>
                        <dd className="font-medium">{procurementMethodLabel(plainText(strategy.metodeSeleksi) || plainText(detail.metode))}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status rekomendasi</dt>
                        <dd className="font-medium">{plainText(selection.status).replaceAll("_", " ") || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Peringkat / skor</dt>
                        <dd className="font-medium">{participant ? `${plainText(participant.peringkat) || "—"} / ${plainText(participant.skor) || "—"}` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Kuorum suara</dt>
                        <dd className="font-medium">
                          {votes.length} / {records(assignments?.assignments).length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Harga penawaran</dt>
                        <dd className="font-medium">{amount(offer?.hargaPenawaran, plainText(offer?.mataUang))}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Harga negosiasi</dt>
                        <dd className="font-medium">{amount(negotiation?.hargaHasilNegosiasi, plainText(offer?.mataUang))}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">Hasil negosiasi</dt>
                        <dd className="font-medium">{plainText(negotiation?.hasil) || "—"}</dd>
                      </div>
                    </dl>
                    {votes.length ? (
                      <div>
                        <h4 className="text-sm font-semibold">Alasan anggota</h4>
                        <ul className="mt-2 space-y-2">
                          {votes.map((vote) => (
                            <li key={String(vote.id)} className="rounded-md border bg-background p-3 text-sm">
                              <span className="font-medium">{plainText(object(object(vote.assignment).user).nama) || "Anggota"}</span>
                              <p className="mt-1 text-muted-foreground">{plainText(vote.alasan) || "—"}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                );
              })()
            : null}
          {selected?.key === "verifikasi"
            ? (() => {
                const vendor = values.vendorId ? (vendors.data ?? []).find((row) => row.id === values.vendorId) : undefined;
                const documents = records(vendor?.vendorDocuments).filter((doc) => doc.status !== "replaced");
                const downloadDocument = async (documentId: string, filename: string) => {
                  try {
                    setDocumentError("");
                    const cookie = document.cookie
                      .split(";")
                      .map((part) => part.trim())
                      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
                      ?.slice(SESSION_COOKIE.length + 1);
                    const authToken = readSession(cookie)?.token;
                    if (!authToken) throw new Error("Sesi login tidak valid. Silakan login kembali.");
                    const response = await fetch(`${process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001"}/api/vendor-onboarding/documents/${documentId}/file`, { headers: { Authorization: `Bearer ${authToken}` } });
                    if (!response.ok) throw new Error("Dokumen tidak dapat diunduh.");
                    const blobUrl = URL.createObjectURL(await response.blob());
                    const win = window.open(blobUrl, "_blank");
                    if (!win) throw new Error("Popup blocker mencegah pembukaan tab baru.");
                  } catch (cause) {
                    setDocumentError(cause instanceof Error ? cause.message : "Dokumen gagal dibuka.");
                  }
                };
                return (
                  <section className="space-y-2 rounded-lg border bg-card p-4">
                    <h3 className="text-sm font-semibold">Dokumen onboarding vendor</h3>
                    {!values.vendorId ? (
                      <p className="text-sm text-muted-foreground">Pilih vendor untuk memeriksa dokumen onboarding.</p>
                    ) : documents.length ? (
                      <div className="space-y-2">
                        <ul className="space-y-2">
                          {documents.map((doc) => (
                            <li key={String(doc.id)} className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2">
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${doc.status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                                  aria-label={doc.status === "verified" ? "Terverifikasi" : "Menunggu verifikasi"}
                                >
                                  <Check size={13} strokeWidth={2.5} />
                                </span>
                                <span>
                                  {String(doc.jenis)} · {doc.status === "verified" ? "Terverifikasi" : "Menunggu verifikasi"}
                                </span>
                              </span>
                              <Button type="button" variant="outline" size="sm" onClick={() => void downloadDocument(String(doc.id), `${String(doc.jenis)}.pdf`)}>
                                <ExternalLink size={14} className="mr-1" />
                                Lihat
                              </Button>
                            </li>
                          ))}
                        </ul>
                        {documents.some((doc) => doc.jenis === "SURAT_KUASA_PENUNJUKAN_PENANDATANGAN") ? null : (
                          <p className="text-xs text-muted-foreground">Surat Kuasa diperlukan bila kewenangan penandatangan tidak tercantum dalam Akta.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum ada dokumen onboarding.</p>
                    )}
                    {documentError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {documentError}
                      </p>
                    ) : null}
                  </section>
                );
              })()
            : null}
          <fieldset disabled={locked || !permitted} className="space-y-4">
            {selected?.key === "rfq" ? (
              <p className="text-sm text-muted-foreground">
                {isPublicDirectPurchase
                  ? "Terbitkan RFQ publik. Vendor yang telah disetujui dapat mengirim penawaran hingga batas respons."
                  : values.mode === "baru"
                    ? "Terbitkan RFQ baru kepada vendor pilihan."
                    : values.mode === "tambah_vendor"
                      ? "Pilih RFQ aktif dan vendor baru. Ketentuan akan disalin dari RFQ acuan."
                      : "Nilai awal disalin dari RFQ pertama yang dipilih. Perubahan akan diterapkan ke seluruh vendor dan RFQ acuan terpilih sebagai revisi baru."}
              </p>
            ) : null}
            {selected?.key === "negosiasi" ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm leading-5 text-sky-950">
                Pilih penawaran lulus evaluasi. Nomor putaran dibuat sistem. Target harga bersifat internal dan tidak ditampilkan kepada vendor.
              </div>
            ) : null}
            {selected?.key === "penawaran" ? <p className="text-sm text-muted-foreground">Catat satu penawaran per vendor dan nomor RFQ. Ulangi hanya untuk vendor yang sudah menyampaikan penawaran.</p> : null}
            {selected?.key === "negosiasi" && values.penawaranId
              ? (() => {
                  const offer = records(detail.penawaran).find((row) => String(row.id ?? "") === values.penawaranId);
                  if (!offer) return null;
                  const participant = records(object(detail.pemilihanPenyedia).peserta).find((row) => String(row.penawaranId ?? "") === values.penawaranId);
                  const snapshot = object(object(offer.detail).rfqBaseline);
                  const negotiations = records(offer.negosiasi);
                  const nextRound = Math.max(0, ...negotiations.map((row) => Number(row.putaran) || 0)) + 1;
                  const formatAmount = (value: unknown, currency = "") => {
                    if (value == null || value === "") return "—";
                    const amount = Number(value);
                    const formatted = Number.isFinite(amount) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(amount) : String(value);
                    return [currency, formatted].filter(Boolean).join(" ");
                  };
                  const currency = plainText(offer.mataUang);
                  const unit = plainText(snapshot.satuan) || plainText(object(detail.perencanaan).satuan);
                  const volume = plainText(snapshot.volume);
                  const offerNote = plainText(object(offer.detail).catatan);
                  return (
                    <section className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm" aria-label="Rincian penawaran terpilih">
                      <div className="space-y-3 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Penawaran terpilih</p>
                            <h3 className="text-base font-semibold text-slate-900">{plainText(object(offer.vendor).nama) || "Vendor"}</h3>
                          </div>
                          <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800">Putaran {nextRound} · otomatis</span>
                        </div>
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-500">Harga penawaran awal per satuan</dt>
                            <dd className="font-semibold text-slate-900">
                              {formatAmount(offer.hargaPenawaran, currency)}
                              {unit ? ` / ${unit}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Harga acuan evaluasi per satuan</dt>
                            <dd className="font-semibold text-slate-900">
                              {formatAmount(participant?.nilaiHargaAcuan, currency)}
                              {unit ? ` / ${unit}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Subtotal barang awal</dt>
                            <dd className="font-semibold text-slate-900">
                              {offer.hargaPenawaran != null && volume && Number.isFinite(Number(offer.hargaPenawaran)) && Number.isFinite(Number(volume)) ? formatAmount(Number(offer.hargaPenawaran) * Number(volume), currency) : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Total biaya perolehan evaluasi</dt>
                            <dd className="font-semibold text-slate-900">{formatAmount(participant?.totalBiayaPerolehan, currency)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Volume acuan RFQ</dt>
                            <dd className="font-semibold text-slate-900">{[volume, unit].filter(Boolean).join(" ") || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Sumber harga acuan</dt>
                            <dd className="font-semibold text-slate-900">{plainText(participant?.sumberHargaAcuan) || "—"}</dd>
                          </div>
                        </dl>
                        {offer.berlakuSampai ? (
                          <p className="text-sm text-slate-600">
                            Berlaku sampai: <strong className="font-medium text-slate-900">{new Date(String(offer.berlakuSampai)).toLocaleDateString("id-ID", { dateStyle: "long" })}</strong>
                          </p>
                        ) : null}
                        {offerNote ? (
                          <p className="break-words text-sm text-slate-600">
                            Catatan: <span className="text-slate-800">{offerNote}</span>
                          </p>
                        ) : null}
                      </div>
                    </section>
                  );
                })()
              : null}
            {operationFieldSections(selected?.key, fields)
              .filter((section) => section.fields.length > 0)
              .map((section) => (
                <section key={section.title} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {section.fields.map((field) => {
                      const fieldId = `${id}-${field.name}`;
                      const isSelect = !!field.relation || !!field.options || field.kind === "boolean";
                      const isLongText = field.payloadPath !== undefined;
                      return (
                        <div
                          key={field.name}
                          className={`min-w-0 space-y-1.5${(selected?.key === "rfq" && ["vendorIds", "rfqId", "rfqIds", "alasanPerubahan", "spesifikasi", "dokumenDiminta"].includes(field.name)) || (selected?.key === "negosiasi" && ["penawaranId", "hasil"].includes(field.name)) ? " sm:col-span-2" : ""}`}
                        >
                          <Label htmlFor={fieldId} className="block min-h-0 leading-5">
                            {selected?.key === "negosiasi" && field.name === "hargaHasilNegosiasi" ? "Harga negosiasi per satuan" : field.label}
                            {field.required ? " *" : ""}
                          </Label>
                          {selected?.key === "negosiasi" && field.name === "batasNegosiasi" ? (
                            <p className="min-h-8 text-xs leading-4 text-muted-foreground">Opsional. Harga per satuan untuk acuan internal; tidak dikirim kepada vendor.</p>
                          ) : null}
                          {selected?.key === "negosiasi" && field.name === "hargaHasilNegosiasi" ? (
                            <p className="min-h-8 text-xs leading-4 text-muted-foreground">Isi harga per satuan, bukan total volume. Mata uang dan satuan mengikuti penawaran.</p>
                          ) : null}
                          {field.multiple && field.relation && field.relation !== "vendor" ? (
                            <div className="space-y-2">
                              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
                                {(values[field.name] ?? "")
                                  .split(",")
                                  .filter(Boolean)
                                  .map((choiceId) => {
                                    const choice = options(field).find((item) => item.value === choiceId);
                                    return (
                                      <span key={choiceId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                        {choice?.label ?? choiceId}
                                        <button
                                          type="button"
                                          aria-label={`Hapus ${field.label}`}
                                          disabled={locked}
                                          onClick={() =>
                                            setValues((old) => ({
                                              ...old,
                                              [field.name]: (old[field.name] ?? "")
                                                .split(",")
                                                .filter((value) => value && value !== choiceId)
                                                .join(","),
                                            }))
                                          }
                                        >
                                          <X size={13} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                {!values[field.name] ? <span className="px-1 text-xs text-muted-foreground">Pilih satu atau beberapa RFQ</span> : null}
                              </div>
                              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1" role="group" aria-label={field.label}>
                                {options(field).map((choice) => {
                                  const selectedIds = (values[field.name] ?? "").split(",").filter(Boolean);
                                  const checked = selectedIds.includes(choice.value);
                                  return (
                                    <button
                                      key={choice.value}
                                      type="button"
                                      disabled={locked}
                                      onClick={() => setValues((old) => ({ ...old, [field.name]: checked ? selectedIds.filter((value) => value !== choice.value).join(",") : [...selectedIds, choice.value].join(",") }))}
                                      className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                    >
                                      <span>{choice.label}</span>
                                      {checked ? <Check size={16} className="text-primary" /> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : field.multiple && field.relation === "vendor" ? (
                            <div className="space-y-2">
                              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
                                {(values[field.name] ?? "")
                                  .split(",")
                                  .filter(Boolean)
                                  .map((vendorId) => {
                                    const choice = options(field).find((item) => item.value === vendorId);
                                    return (
                                      <span key={vendorId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                        {choice?.label ?? vendorId}
                                        <button
                                          type="button"
                                          aria-label={`Hapus ${choice?.label ?? "vendor"}`}
                                          disabled={locked}
                                          onClick={() =>
                                            setValues((old) => ({
                                              ...old,
                                              [field.name]: (old[field.name] ?? "")
                                                .split(",")
                                                .filter((id) => id && id !== vendorId)
                                                .join(","),
                                            }))
                                          }
                                        >
                                          <X size={13} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                <span className="px-1 text-xs text-muted-foreground">{(values[field.name] ?? "").split(",").filter(Boolean).length ? "Vendor dipilih" : "Pilih vendor di bawah"}</span>
                              </div>
                              <Input
                                placeholder="Cari vendor…"
                                aria-label="Cari vendor tujuan"
                                value={values.__vendorSearch ?? ""}
                                disabled={locked || vendorBlocked}
                                onChange={(event) => setValues((old) => ({ ...old, __vendorSearch: event.target.value }))}
                              />
                              <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-1" role="group" aria-label="Vendor tujuan">
                                {options(field)
                                  .filter((choice) => choice.label.toLocaleLowerCase("id-ID").includes((values.__vendorSearch ?? "").toLocaleLowerCase("id-ID")))
                                  .map((choice) => {
                                    const selectedIds = (values[field.name] ?? "").split(",").filter(Boolean);
                                    const checked = selectedIds.includes(choice.value);
                                    return (
                                      <button
                                        key={choice.value}
                                        type="button"
                                        disabled={locked}
                                        onClick={() => setValues((old) => ({ ...old, [field.name]: checked ? selectedIds.filter((id) => id !== choice.value).join(",") : [...selectedIds, choice.value].join(",") }))}
                                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                      >
                                        <span>{choice.label}</span>
                                        {checked ? <Check size={16} className="text-primary" /> : null}
                                      </button>
                                    );
                                  })}
                                {!vendorBlocked && !options(field).some((choice) => choice.label.toLocaleLowerCase("id-ID").includes((values.__vendorSearch ?? "").toLocaleLowerCase("id-ID"))) ? (
                                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">Vendor tidak ditemukan.</p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={locked || vendorBlocked}
                                  onClick={() =>
                                    setValues((old) => ({
                                      ...old,
                                      [field.name]: options(field)
                                        .map((choice) => choice.value)
                                        .join(","),
                                    }))
                                  }
                                >
                                  Pilih semua ({options(field).length})
                                </Button>
                                <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => setValues((old) => ({ ...old, [field.name]: "" }))}>
                                  Kosongkan pilihan
                                </Button>
                              </div>
                            </div>
                          ) : isSelect && field.relation === "vendor" ? (
                            <FilterCombobox
                              options={options(field)}
                              value={values[field.name] || ""}
                              onValueChange={(value) => setValues((old) => ({ ...old, [field.name]: value }))}
                              label={field.label}
                              disabled={locked || !permitted || vendorBlocked}
                            />
                          ) : isSelect ? (
                            <Select value={values[field.name] || ""} onValueChange={(value) => setValues((old) => ({ ...old, [field.name]: String(value ?? "") }))} disabled={locked || !permitted}>
                              <SelectTrigger id={fieldId} aria-required={field.required} className={selected?.key === "negosiasi" && field.name === "penawaranId" ? "min-w-0" : undefined}>
                                {selected?.key === "negosiasi" && field.name === "penawaranId" ? (
                                  <>
                                    <span className="min-w-0 flex-1 truncate text-left">{options(field).find((option) => option.value === values[field.name])?.label ?? "Pilih penawaran vendor…"}</span>
                                    <SelectValue className="sr-only" />
                                  </>
                                ) : (
                                  <SelectValue placeholder="Pilih penawaran…" />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {!field.required ? <SelectItem value="">Tidak diisi</SelectItem> : null}
                                {options(field).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {selected?.key === "rfq" && field.name === "mode" ? (({ baru: "RFQ baru", tambah_vendor: "Tambah vendor", revisi: "Ubah RFQ" } as Record<string, string>)[option.value] ?? option.label) : option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.kind === "document-list" ? (
                            <div className="space-y-3" aria-describedby={`${fieldId}-hint`}>
                              <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
                                Cantumkan dokumen yang wajib disampaikan vendor beserta ketentuannya.
                              </p>
                              <div className="space-y-2">
                                {parseParameterRows(values[field.name] ?? "").map((row, index, rows) => (
                                  <div key={`${fieldId}-row-${index}`} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`${fieldId}-name-${index}`} className="text-xs">
                                        Nama dokumen
                                      </Label>
                                      <Input
                                        id={`${fieldId}-name-${index}`}
                                        aria-label={`${field.label}: nama dokumen ${index + 1}`}
                                        placeholder="Contoh: Surat penawaran harga"
                                        value={row.name}
                                        onChange={(event) => {
                                          const next = [...rows];
                                          next[index] = { ...row, name: event.target.value };
                                          setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`${fieldId}-detail-${index}`} className="text-xs">
                                        Ketentuan / keterangan
                                      </Label>
                                      <Input
                                        id={`${fieldId}-detail-${index}`}
                                        aria-label={`${field.label}: ketentuan dokumen ${index + 1}`}
                                        placeholder="Contoh: Wajib, ditandatangani pejabat berwenang"
                                        value={row.value}
                                        onChange={(event) => {
                                          const next = [...rows];
                                          next[index] = { ...row, value: event.target.value };
                                          setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                        }}
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      aria-label={`Hapus dokumen ${index + 1}`}
                                      disabled={rows.length === 1}
                                      onClick={() => {
                                        const next = rows.filter((_, rowIndex) => rowIndex !== index);
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    >
                                      Hapus
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const next = [...parseParameterRows(values[field.name] ?? ""), { name: "", value: "" }];
                                  setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                }}
                              >
                                Tambah dokumen
                              </Button>
                            </div>
                          ) : field.kind === "json" ? (
                            <div className="space-y-3" aria-describedby={`${fieldId}-hint`}>
                              <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
                                Isi kolom parameter dan nilai. Contoh parameter sesuai kebutuhan:{" "}
                                {field.name === "kesiapanPenerima" ? "Fasilitas, kapasitas, jadwal penerimaan." : field.name === "analisisPasar" ? "Pasokan, harga, risiko pasar." : "Kadar sulfur, densitas, viskositas."}
                              </p>
                              <div className="space-y-2">
                                {parseParameterRows(values[field.name] ?? "").map((row, index, rows) => (
                                  <div key={`${fieldId}-row-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2">
                                    <Input
                                      aria-label={`${field.label}: parameter ${index + 1}`}
                                      placeholder="Parameter"
                                      value={row.name}
                                      onChange={(event) => {
                                        const next = [...rows];
                                        next[index] = { ...row, name: event.target.value };
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    />
                                    <Input
                                      aria-label={`${field.label}: nilai ${index + 1}`}
                                      placeholder="Nilai"
                                      value={row.value}
                                      onChange={(event) => {
                                        const next = [...rows];
                                        next[index] = { ...row, value: event.target.value };
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      aria-label={`Hapus parameter ${index + 1}`}
                                      disabled={rows.length === 1}
                                      onClick={() => {
                                        const next = rows.filter((_, rowIndex) => rowIndex !== index);
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    >
                                      Hapus
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const next = [...parseParameterRows(values[field.name] ?? ""), { name: "", value: "" }];
                                  setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                }}
                              >
                                Tambah parameter
                              </Button>
                            </div>
                          ) : isLongText || field.kind === "textarea" ? (
                            <textarea
                              id={fieldId}
                              value={values[field.name] ?? ""}
                              onChange={(event) => setValues((old) => ({ ...old, [field.name]: event.target.value }))}
                              required={field.required}
                              rows={3}
                              placeholder={`${field.label}…`}
                              className="w-full rounded-md border border-input bg-background p-3 text-sm leading-6"
                            />
                          ) : (
                            <Input
                              id={fieldId}
                              type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
                              step={field.kind === "number" ? (field.integer ? "1" : "any") : undefined}
                              min={field.min}
                              maxLength={field.maxLength}
                              required={field.required}
                              value={values[field.name] ?? ""}
                              onChange={(event) => setValues((old) => ({ ...old, [field.name]: event.target.value }))}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
          </fieldset>
        </form>
      </Modal>
    </section>
  );
}

export default LifecycleOperations;
