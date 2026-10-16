"use client";

import { useId, useRef, useState } from "react";
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
function choices(rows: Entity[]): Choice[] {
  return rows
    .filter((row) => typeof row.id === "string")
    .map((row) => ({ value: String(row.id), label: [row.nomor ?? row.nama ?? row.namaKapal ?? row.nomorBillOfLading ?? row.jenis ?? row.id, object(row.vendor).nama, row.status].filter(Boolean).join(" · ") }));
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
  const uninitialized = stage === "perencanaan" && Array.isArray(detail.tahapan) && detail.tahapan.length === 0;
  const available = lifecycleOperations.filter((op) => op.stages.includes(stage) && op.roles.includes(role) && (!uninitialized || op.key === "perencanaan") && (!op.available || op.available(detail)));
  const fields = selected?.fields.filter((field) => !(role === "vendor" && field.name === "vendorId")) ?? [];
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
  function open(operation: Operation) {
    if (locked || !active) return;
    const initial: Record<string, string> = {};
    const seed = object(operation.seed ? detail[operation.seed] : null);
    for (const field of operation.fields) {
      const value = seed[field.name];
      const seedValue = field.payloadPath ? field.payloadPath.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Entity)[key] : undefined), seed) : value;
      if (seedValue == null) continue;
      initial[field.name] = field.kind === "json" ? JSON.stringify(seedValue, null, 2) : field.kind === "date" ? String(seedValue).slice(0, 10) : String(seedValue);
    }
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
      const body = operationPayload(fields, values, options);
      submitting.current = true;
      await mutation.mutateAsync({ operation: selected, body });
      setSuccess(`${selected.title}: berhasil.`);
      setSelected(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      submitting.current = false;
    }
  }
  return (
    <section className="space-y-3" aria-label="Operasi bisnis tahap">
      {user.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(user.error)}</AlertDescription>
        </Alert>
      ) : null}
      {!active ? <p className="text-sm text-muted-foreground">Operasi dinonaktifkan: tahap ini tidak aktif.</p> : null}
      {active && !user.isPending && !user.isError && !available.length ? <p className="text-sm text-muted-foreground">Tidak ada operasi tersedia untuk peran atau status saat ini.</p> : null}
      <div className="flex flex-wrap gap-2">
        {available.map((operation) => (
          <Button key={operation.key} type="button" variant="outline" disabled={!active || locked} onClick={() => open(operation)}>
            {operation.title}
          </Button>
        ))}
      </div>
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
            {selected?.key === "rfq" ? <p className="text-sm text-muted-foreground">Lengkapi kebutuhan RFQ. Informasi yang diisi akan dikirim kepada vendor terpilih.</p> : null}
            {selected?.key === "penawaran" ? <p className="text-sm text-muted-foreground">Masukkan rincian penawaran vendor pada kolom terpisah, bukan sebagai JSON.</p> : null}
            {fields.map((field) => {
              const fieldId = `${id}-${field.name}`;
              const isSelect = !!field.relation || !!field.options || field.kind === "boolean";
              const isLongText = field.payloadPath !== undefined;
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={fieldId}>
                    {field.label}
                    {field.required ? " *" : ""}
                  </Label>
                  {isSelect ? (
                    <Select value={values[field.name] || ""} onValueChange={(value) => setValues((old) => ({ ...old, [field.name]: String(value ?? "") }))} disabled={locked || !permitted || (field.relation === "vendor" && vendorBlocked)}>
                      <SelectTrigger id={fieldId} aria-required={field.required}>
                        <SelectValue placeholder="Pilih…" />
                      </SelectTrigger>
                      <SelectContent>
                        {!field.required ? <SelectItem value="">Tidak diisi</SelectItem> : null}
                        {options(field).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.kind === "json" || isLongText ? (
                    <textarea
                      id={fieldId}
                      value={values[field.name] ?? ""}
                      onChange={(event) => setValues((old) => ({ ...old, [field.name]: event.target.value }))}
                      required={field.required}
                      rows={isLongText ? 3 : 4}
                      placeholder={isLongText ? `${field.label}…` : '{"key": "value"}'}
                      className={`w-full rounded-md border border-input bg-background p-2 text-sm ${field.kind === "json" ? "font-mono" : ""}`}
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
          </fieldset>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </Modal>
    </section>
  );
}

export default LifecycleOperations;
