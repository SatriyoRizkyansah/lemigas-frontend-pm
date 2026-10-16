"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { Modal } from "@/components/modal/Modal";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { getApiErrorMessage } from "@/lib/api/errors";
import { ContentType } from "@/lib/api/generated/api-generated";
import { downloadDocument } from "@/lib/api/download";

type Entity = Record<string, any>;
type Evidence = Entity & { id: string; jenisRecord: string; recordId: string; dokumenId: string; dokumen?: Entity };
type Target = { type: string; label: string; id: string; name: string };
const targetLabels: Record<string, string> = {
  penawaran: "Penawaran",
  memorandum: "Memorandum",
  kontrak: "Kontrak",
  pengiriman: "Pengiriman",
  pemeriksaan: "Pemeriksaan",
  penerimaan: "Penerimaan",
  tagihan: "Tagihan",
  pembayaran: "Pembayaran",
  klaim: "Klaim",
  laporan: "Laporan",
};
const targetTypes = Object.keys(targetLabels);
function unwrap(value: unknown): any {
  let current = value as any;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && "data" in current; depth += 1) current = current.data;
  return current;
}
function rows(value: unknown): Entity[] {
  return Array.isArray(value) ? value.filter((row): row is Entity => Boolean(row && typeof row === "object")) : [];
}
function targetName(row: Entity, type: string): string {
  return String(row.nomor ?? row.nomorBast ?? row.nomorRfq ?? row.nomorBillOfLading ?? row.namaKapal ?? row.jenis ?? row.judul ?? row.nama ?? `${targetLabels[type]} ${row.id}`);
}
function targetOptions(detail: Entity): Target[] {
  const options: Target[] = [];
  for (const type of targetTypes) {
    const source = type === "memorandum" ? (detail.memorandum ? [detail.memorandum] : []) : rows(detail[type]);
    for (const row of source) if (typeof row.id === "string") options.push({ type, id: row.id, name: targetName(row, type), label: targetLabels[type] });
  }
  for (const shipment of rows(detail.pengiriman)) {
    for (const inspection of rows(shipment.pemeriksaan)) if (typeof inspection.id === "string") options.push({ type: "pemeriksaan", id: inspection.id, name: targetName(inspection, "pemeriksaan"), label: targetLabels.pemeriksaan });
    if (shipment.penerimaan?.id) options.push({ type: "penerimaan", id: shipment.penerimaan.id, name: targetName(shipment.penerimaan, "penerimaan"), label: targetLabels.penerimaan });
  }
  return [...new Map(options.map((target) => [`${target.type}:${target.id}`, target])).values()];
}

export function LifecycleEvidence({ pengadaanId, detail }: { pengadaanId: string; detail: Entity }) {
  const user = useCurrentUser();
  const role = String(user.data?.role ?? "").toLowerCase();
  const canMutate = ["admin", "operator"].includes(role);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [recordId, setRecordId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [error, setError] = useState("");
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadFailure, setDownloadFailure] = useState<{ id: string; name: string; message: string } | null>(null);
  const [unlink, setUnlink] = useState<Evidence | null>(null);
  const targets = useMemo(() => targetOptions(detail ?? {}), [detail]);
  const documents = use_query<Entity[], Error, string>({
    tag: "dokumen",
    method: "lifecycleEvidenceDocuments",
    params: pengadaanId,
    enabled: Boolean(pengadaanId && role),
    queryFn: async (id) => {
      setBrowserToken();
      const payload = unwrap(await apiData(browserApi.dokumen.dokumenGetControllerFindByPengadaan(id, { format: "json" }) as unknown as Promise<{ data: unknown }>));
      if (!Array.isArray(payload)) throw new Error("Respons daftar dokumen tidak valid.");
      return rows(payload).filter((row) => row.pengadaanId === id && typeof row.id === "string");
    },
  });
  const evidence = use_query<Evidence[], Error, string>({
    tag: "lifecycleEvidence",
    method: "lifecycleEvidenceList",
    params: pengadaanId,
    enabled: Boolean(pengadaanId && role),
    queryFn: async (id) => {
      setBrowserToken();
      return rows(unwrap(await apiData(browserApi.request<any, any>({ path: `/api/pengadaan/${encodeURIComponent(id)}/evidence`, method: "GET", format: "json", secure: true })))).filter(
        (row): row is Evidence => typeof row.id === "string" && typeof row.jenisRecord === "string" && typeof row.recordId === "string" && typeof row.dokumenId === "string",
      );
    },
  });
  const mutation = use_mutation<unknown, Error, { method: "POST" | "DELETE"; relationId?: string; body?: Entity }>({
    tag: "lifecycleEvidence",
    method: "lifecycleEvidenceMutation",
    invalidateKeys: [apiQueryKeys.resource("lifecycleEvidence"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("siklusTransaksiKomoditas")],
    mutationFn: async (input) => {
      setBrowserToken();
      return unwrap(
        await apiData(
          browserApi.request<any, any>({
            path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/evidence${input.relationId ? `/${encodeURIComponent(input.relationId)}` : ""}`,
            method: input.method,
            body: input.body,
            ...(input.body ? { type: ContentType.Json } : {}),
            format: "json",
            secure: true,
          }),
        ),
      );
    },
    onSuccess: () => {
      setUnlink(null);
      setOpen(false);
      setType("");
      setRecordId("");
      setDocumentId("");
    },
  });
  const selectedTargets = targets.filter((target) => target.type === type);
  function close() {
    if (!mutation.isPending) {
      setOpen(false);
      setError("");
    }
  }
  async function download(id: string, name: string) {
    setDownloadId(id);
    setDownloadFailure(null);
    try {
      await downloadDocument(id, name);
    } catch (cause) {
      setDownloadFailure({ id, name, message: getApiErrorMessage(cause) });
    } finally {
      setDownloadId(null);
    }
  }
  function linkDocument(document: Entity | undefined) {
    if (!document) return "Dokumen tidak tersedia";
    const id = String(document.id ?? "");
    if (document.tipePenyimpanan !== "upload_lokal" || !id) return String(document.nama ?? "Dokumen");
    return (
      <Button variant="link" size="sm" disabled={downloadId === id} onClick={() => void download(id, String(document.nama ?? "dokumen"))}>
        {downloadId === id ? "Mengunduh…" : String(document.nama ?? "Dokumen")}
      </Button>
    );
  }
  return (
    <section className="space-y-4 border-t pt-5" aria-label="Bukti dokumen per record lifecycle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Bukti per record lifecycle</h3>
          <p className="mt-1 text-xs text-muted-foreground">Tautkan dokumen yang sudah diunggah ke record transaksi yang terverifikasi.</p>
        </div>
        {canMutate ? (
          <Button
            type="button"
            onClick={() => {
              setError("");
              setOpen(true);
            }}
          >
            Tautkan dokumen
          </Button>
        ) : null}
      </div>
      {downloadFailure ? (
        <Alert variant="destructive">
          <AlertDescription>
            {downloadFailure.message}{" "}
            <Button variant="link" size="sm" disabled={Boolean(downloadId)} onClick={() => void download(downloadFailure.id, downloadFailure.name)}>
              Coba unduh lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {documents.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(documents.error)}{" "}
            <Button variant="link" size="sm" onClick={() => void documents.refetch()}>
              Muat ulang dokumen
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {evidence.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(evidence.error)}{" "}
            <Button variant="link" size="sm" onClick={() => void evidence.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {mutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(mutation.error)}</AlertDescription>
        </Alert>
      ) : null}
      {evidence.isPending ? (
        <LoadingState label="Loading..." />
      ) : (
        <DataTable
          rows={evidence.data ?? []}
          rowKey={(row) => row.id}
          emptyMessage="Belum ada bukti per record."
          columns={[
            { key: "jenisRecord", header: "Record", render: (row) => targetLabels[row.jenisRecord] ?? row.jenisRecord },
            {
              key: "recordId",
              header: "Record terkait",
              render: (row) => targets.find((target) => target.type === row.jenisRecord && target.id === row.recordId)?.name ?? `${targetLabels[row.jenisRecord] ?? row.jenisRecord} ${row.recordId}`,
            },
            { key: "dokumen", header: "Dokumen", render: (row) => linkDocument(row.dokumen) },
            {
              key: "actions",
              header: "Aksi",
              filterable: false,
              render: (row) =>
                canMutate ? (
                  <Button variant="destructive" size="sm" disabled={mutation.isPending} onClick={() => setUnlink(row)}>
                    Lepas
                  </Button>
                ) : null,
            },
          ]}
        />
      )}
      <Modal
        open={open}
        onClose={close}
        title="Tautkan bukti lifecycle"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={mutation.isPending} onClick={close}>
              Batal
            </Button>
            <Button
              disabled={mutation.isPending || documents.isPending || documents.isError || !selectedTargets.some((target) => target.id === recordId) || !(documents.data ?? []).some((document) => document.id === documentId)}
              onClick={() => {
                setError("");
                mutation.mutate({ method: "POST", body: { jenisRecord: type, recordId, dokumenId: documentId } });
              }}
            >
              Tautkan
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {documents.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(documents.error)}{" "}
                <Button variant="link" onClick={() => void documents.refetch()}>
                  Coba lagi
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Jenis record</span>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value ?? "");
                setRecordId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis record" />
              </SelectTrigger>
              <SelectContent>
                {targetTypes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {targetLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Record</span>
            <Select value={recordId} onValueChange={(value) => setRecordId(value ?? "")} disabled={!type}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih record" />
              </SelectTrigger>
              <SelectContent>
                {selectedTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Dokumen yang sudah diunggah</span>
            <Select value={documentId} onValueChange={(value) => setDocumentId(value ?? "")}>
              <SelectTrigger>
                <SelectValue placeholder={documents.isPending ? "Memuat dokumen…" : "Pilih dokumen"} />
              </SelectTrigger>
              <SelectContent>
                {(documents.data ?? []).map((document) => (
                  <SelectItem key={String(document.id)} value={String(document.id)}>
                    {String(document.nama ?? document.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(unlink)}
        onClose={() => {
          if (!mutation.isPending) setUnlink(null);
        }}
        title="Lepas bukti lifecycle"
        message="Lepas tautan bukti dari record ini? Dokumen tetap tersimpan."
        confirmLabel="Lepas tautan"
        busy={mutation.isPending}
        onConfirm={() => {
          if (unlink && canMutate && !mutation.isPending) mutation.mutate({ method: "DELETE", relationId: unlink.id });
        }}
      />
    </section>
  );
}
