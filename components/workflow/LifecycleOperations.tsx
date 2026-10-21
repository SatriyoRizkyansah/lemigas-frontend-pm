"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, ClipboardList, FileCheck2, FileText, Handshake, Send, Settings2, Ship, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { getApiErrorMessage } from "@/lib/api/errors";
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
  return rows
    .filter((row) => typeof row.id === "string")
    .map((row) => ({ value: String(row.id), label: [row.nomor ?? row.nama ?? row.namaKapal ?? row.nomorBillOfLading ?? row.jenis ?? row.id, object(row.vendor).nama, row.status].filter(Boolean).join(" · ") }));
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
  const role = String(object(unwrap(user.data)).role ?? "").toLowerCase();
  const id = useId();
  const [selected, setSelected] = useState<Operation | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const submitting = useRef(false);
  const revisionSeedKey = useRef("");
  const uninitialized = stage === "perencanaan" && Array.isArray(detail.tahapan) && detail.tahapan.length === 0;
  const available = lifecycleOperations.filter((op) => op.stages.includes(stage) && op.roles.includes(role) && (!uninitialized || op.key === "perencanaan") && (!op.available || op.available(detail)));
  const fields =
    selected?.fields
      .filter((field) => {
        if (role === "vendor" && field.name === "vendorId") return false;
        if (selected.key === "tutupRfq" || selected.key === "bukaKembaliRfq") return false;
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
      return choices([...all.values()].filter((row) => selected?.key !== "penawaran" || row.status === "aktif"));
    }
    if (field.relation === "rfqAktif" || field.relation === "rfqTertutup") {
      const rows = records(detail.rfq).filter((row) => row.status === (field.relation === "rfqAktif" ? "aktif" : "selesai"));
      const unique = new Map<string, Entity>();
      for (const row of rows) {
        const key = String(row.kelompokId ?? row.id ?? "");
        const current = unique.get(key);
        if (!current || Number(row.revisi ?? 1) > Number(current.revisi ?? 1)) unique.set(key, row);
      }
      return [...unique.values()].map((row) => ({ value: String(row.id ?? ""), label: `${String(row.nomor ?? "RFQ")} · ${String(object(row.vendor).nama ?? "vendor")} · R${String(row.revisi ?? 1)}` }));
    }
    if (field.relation) return choices(field.relation === "laporanDraft" ? records(detail.laporan).filter((row) => row.status === "draft") : records(detail[field.relation]));
    if (field.kind === "boolean")
      return [
        { value: "true", label: "Ya" },
        { value: "false", label: "Tidak" },
      ];
    return (field.options ?? []).map((value) => ({ value, label: value.replaceAll("_", " ") }));
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
  const locked = mutation.isPending || submitting.current;
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
    setValues((current) => ({
      ...current,
      nomor: String(rfq.nomor ?? "").replace(/-R\d+$/, ""),
      batasRespons: rfq.batasRespons ? String(rfq.batasRespons).slice(0, 10) : "",
      spesifikasi: parameterText(normalizedTerm(terms, "spesifikasi")),
      volume: plainText(normalizedTerm(terms, "volume")),
      satuan: plainText(normalizedTerm(terms, "satuan")),
      titikSerah: plainText(normalizedTerm(terms, "titikSerah")),
      syaratPenyerahan: plainText(normalizedTerm(terms, "syaratPenyerahan")),
      syaratPembayaran: plainText(normalizedTerm(terms, "syaratPembayaran")),
      dokumenDiminta: parameterText(normalizedTerm(terms, "dokumenDiminta")),
    }));
  }, [detail.rfq, selected?.key, values.mode, values.rfqIds]);
  function open(operation: Operation) {
    if (locked || !active) return;
    const initial: Record<string, string> = operation.key === "rfq" ? { mode: "baru" } : {};
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
    revisionSeedKey.current = "";
    setValues(initial);
    setSelected(operation);
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
      setSuccess(selected.key === "rfq" ? `RFQ berhasil diterbitkan kepada ${(body.vendorIds as string[] | undefined)?.length ?? 1} vendor.` : `${selected.title}: berhasil.`);
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
    rfq: { description: "Kirim atau perbarui permintaan penawaran kepada vendor.", icon: Send },
    tutupRfq: { description: "Akhiri penerimaan penawaran untuk RFQ aktif.", icon: FileCheck2 },
    bukaKembaliRfq: { description: "Aktifkan kembali RFQ yang telah ditutup.", icon: FileText },
    verifikasi: { description: "Periksa legalitas, kepatuhan, dan rekening vendor.", icon: FileCheck2 },
    negosiasi: { description: "Catat putaran negosiasi dan hasil komersial.", icon: Handshake },
    memorandum: { description: "Susun rekomendasi transaksi untuk persetujuan.", icon: FileText },
    kontrak: { description: "Catat kesepakatan dan dokumen kontrak.", icon: FileCheck2 },
    pengiriman: { description: "Pantau pengapalan dan status pengiriman kargo.", icon: Ship },
    tagihan: { description: "Kelola tagihan, pembayaran, dan rekonsiliasi.", icon: Wallet },
  };
  return (
    <section className="space-y-4" aria-label="Operasi bisnis tahap">
      {user.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(user.error)}</AlertDescription>
        </Alert>
      ) : null}
      {!active ? <p className="text-sm text-muted-foreground">Operasi dinonaktifkan: tahap ini tidak aktif.</p> : null}
      {active && !user.isPending && !user.isError && !available.length ? (
        <p className="rounded-lg border border-dashed bg-background px-4 py-5 text-center text-sm text-muted-foreground">Belum ada operasi yang tersedia untuk peran atau status saat ini.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {available
          // Keep manual offer-entry operation configured for future use, but hide it from current workflow.
          .filter((operation) => !["tutupRfq", "bukaKembaliRfq", "penawaran"].includes(operation.key))
          .map((operation) => {
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
        <form id={`${id}-form`} onSubmit={submit} className="max-h-[60vh] space-y-4 overflow-y-auto px-1" aria-busy={locked}>
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
          {!fields.length ? <p>Konfirmasi {selected?.title.toLowerCase()} untuk pengadaan ini.</p> : null}
          <fieldset disabled={locked || !permitted} className="space-y-4">
            {selected?.key === "rfq" ? (
              <p className="text-sm text-muted-foreground">
                {values.mode === "baru"
                  ? "Terbitkan RFQ baru kepada vendor pilihan."
                  : values.mode === "tambah_vendor"
                    ? "Pilih RFQ aktif dan vendor baru. Ketentuan akan disalin dari RFQ acuan."
                    : "Nilai awal disalin dari RFQ pertama yang dipilih. Perubahan akan diterapkan ke seluruh vendor dan RFQ acuan terpilih sebagai revisi baru."}
              </p>
            ) : null}
            {selected?.key === "penawaran" ? <p className="text-sm text-muted-foreground">Catat satu penawaran per vendor dan nomor RFQ. Ulangi hanya untuk vendor yang sudah menyampaikan penawaran.</p> : null}
            {operationFieldSections(selected?.key, fields).map((section) => (
              <section key={section.title} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {section.fields.map((field) => {
                    const fieldId = `${id}-${field.name}`;
                    const isSelect = !!field.relation || !!field.options || field.kind === "boolean";
                    const isLongText = field.payloadPath !== undefined;
                    return (
                      <div key={field.name} className={`min-w-0 space-y-1.5${selected?.key === "rfq" && ["vendorIds", "rfqId", "rfqIds", "alasanPerubahan", "spesifikasi", "dokumenDiminta"].includes(field.name) ? " sm:col-span-2" : ""}`}>
                        <Label htmlFor={fieldId}>
                          {field.label}
                          {field.required ? " *" : ""}
                        </Label>
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
                        ) : isSelect ? (
                          <Select
                            value={values[field.name] || ""}
                            onValueChange={(value) => setValues((old) => ({ ...old, [field.name]: String(value ?? "") }))}
                            disabled={locked || !permitted || (field.relation === "vendor" && vendorBlocked)}
                          >
                            <SelectTrigger id={fieldId} aria-required={field.required}>
                              <SelectValue placeholder="Pilih…" />
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
