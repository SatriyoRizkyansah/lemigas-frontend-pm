"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Modal } from "@/components/modal/Modal";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { getApiErrorMessage } from "@/lib/api/errors";
import { downloadDocument } from "@/lib/api/download";
import type { PenuhiDokumenTahapDto } from "@/lib/api/generated/api-generated";

export type LifecycleDocumentsProps = { pengadaanId: string; stage: string; active: boolean; detail: any };
type Entity = Record<string, unknown>;
type Requirement = Entity & { id: string; jenisDokumen: string };
type UploadBody = Parameters<typeof browserApi.dokumen.dokumenPostControllerUpload>[0];
type Action = { mode: "upload" | "fulfill"; requirementId: string };
const uploadStages: NonNullable<UploadBody["tahap"]>[] = ["perencanaan", "sourcing", "evaluasi_negosiasi", "approval", "kontrak", "delivery", "settlement"];
const stages: PenuhiDokumenTahapDto["tahap"][] = [...uploadStages, "selesai", "gagal", "dibatalkan"];
function object(value: unknown): Entity {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Entity) : {};
}
function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && "data" in current; depth++) current = object(current).data;
  return current;
}
function records(value: unknown): Entity[] {
  return Array.isArray(value) ? value.map(object) : [];
}

/** Parent owns lifecycle loading/errors and supplies current GET siklus detail. */
export function LifecycleDocuments(props: LifecycleDocumentsProps) {
  return <DocumentsPanel key={`${props.pengadaanId}:${props.stage}`} {...props} />;
}

function DocumentsPanel({ pengadaanId, stage, active, detail: rawDetail }: LifecycleDocumentsProps) {
  const detail = object(unwrap(rawDetail));
  const detailMatches = detail.id === pengadaanId;
  const requirements = (detailMatches ? records(detail.persyaratanDokumen) : []).filter(
    (row): row is Requirement => row.pengadaanId === pengadaanId && row.tahap === stage && typeof row.id === "string" && typeof row.jenisDokumen === "string",
  );
  const user = useCurrentUser();
  const role = String(object(unwrap(user.data)).role ?? "").toLowerCase();
  const authenticated = !user.isPending && !user.isError && !!role;
  const canUpload = authenticated && ["admin", "operator"].includes(role);
  const canFulfill = authenticated && ["admin", "operator", "verifikator"].includes(role);
  const id = useId();
  const submitting = useRef(false);
  const [action, setAction] = useState<Action | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [notes, setNotes] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadFailure, setDownloadFailure] = useState<{ id: string; name: string; message: string } | null>(null);
  const documents = use_query<Entity[], Error, string>({
    tag: "dokumen",
    method: "dokumenGetControllerFindByPengadaan",
    params: pengadaanId,
    enabled: authenticated && !!pengadaanId,
    queryFn: async (procurementId) => {
      setBrowserToken();
      const payload = unwrap(await apiData(browserApi.dokumen.dokumenGetControllerFindByPengadaan(procurementId, { format: "json" }) as unknown as Promise<{ data: unknown }>));
      if (!Array.isArray(payload)) throw new Error("Respons daftar dokumen tidak valid.");
      return records(payload).filter((row) => row.pengadaanId === procurementId && typeof row.id === "string");
    },
  });
  const linkedDocuments = documents.data ?? [];
  const shipments = detailMatches ? records(detail.pengiriman).filter((row) => row.pengadaanId === pengadaanId && typeof row.id === "string") : [];
  const requirement = requirements.find((row) => row.id === action?.requirementId);
  const stageValid = stages.some((value) => value === stage);
  const uploadStage = uploadStages.find((value) => value === stage);
  const permitted = active && detailMatches && !!requirement && stageValid && (action?.mode === "upload" ? canUpload && !!uploadStage : canFulfill);
  const mutation = use_mutation<unknown, Error, { mode: "upload"; body: UploadBody } | { mode: "fulfill"; body: PenuhiDokumenTahapDto }>({
    tag: "dokumen",
    method: "lifecycleDocuments",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("lifecycleEvidence"), apiQueryKeys.resource("dokumen"), apiQueryKeys.resource("pengadaan")],
    mutationFn: async (variables) => {
      setBrowserToken();
      return variables.mode === "upload"
        ? apiData(browserApi.dokumen.dokumenPostControllerUpload(variables.body, { format: "json" }) as unknown as Promise<{ data: unknown }>)
        : apiData(browserApi.siklusTransaksiKomoditas.transaksiControllerPenuhiDokumenTahap(pengadaanId, variables.body, { format: "json" }) as unknown as Promise<{ data: unknown }>);
    },
  });
  const locked = mutation.isPending || submitting.current;
  function open(mode: Action["mode"], row: Requirement) {
    if (locked || !active || !detailMatches || (mode === "upload" ? !canUpload || !uploadStage : !canFulfill)) return;
    setAction({ mode, requirementId: row.id });
    setFile(null);
    setName(row.jenisDokumen);
    setDocumentId("");
    setNotes("");
    setShipmentId("");
    setNumber("");
    setError("");
    setSuccess("");
    mutation.reset();
  }
  function close() {
    if (submitting.current || mutation.isPending) return;
    setAction(null);
    setFile(null);
    setError("");
    mutation.reset();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || mutation.isPending || !permitted || !requirement || !action) return;
    setError("");
    setSuccess("");
    try {
      if (!requirement.jenisDokumen.trim() || requirement.jenisDokumen.length > 50) throw new Error("Jenis dokumen persyaratan tidak valid (maksimal 50 karakter).");
      if (action.mode === "upload") {
        if (!file || !file.size || file.size > 10 * 1024 * 1024) throw new Error("Pilih file tidak kosong, maksimal 10 MB.");
        if (!name.trim()) throw new Error("Nama dokumen wajib diisi.");
        if (!uploadStage) throw new Error("Tahap tidak mendukung unggahan.");
        if (shipmentId && !shipments.some((row) => row.id === shipmentId)) throw new Error("Pengiriman tidak terhubung ke pengadaan ini.");
        submitting.current = true;
        await mutation.mutateAsync({
          mode: "upload",
          body: {
            file,
            pengadaanId,
            nama: name.trim(),
            tipePenyimpanan: "upload_lokal",
            tahap: uploadStage,
            jenisDokumen: requirement.jenisDokumen,
            ...(stage === "delivery" && shipmentId ? { pengirimanId: shipmentId } : {}),
            ...(stage === "delivery" && number.trim() ? { nomorDokumen: number.trim() } : {}),
          },
        });
      } else {
        if (documents.isPending || documents.isError || !linkedDocuments.some((row) => row.id === documentId && row.pengadaanId === pengadaanId)) throw new Error("Pilih dokumen yang terhubung ke pengadaan ini.");
        const tahap = stages.find((value) => value === stage);
        if (!tahap) throw new Error("Tahap tidak valid.");
        submitting.current = true;
        await mutation.mutateAsync({ mode: "fulfill", body: { tahap, jenisDokumen: requirement.jenisDokumen, dokumenId: documentId, ...(notes.trim() ? { catatan: notes.trim() } : {}) } });
      }
      setSuccess(action.mode === "upload" ? "Dokumen diunggah; persyaratan otomatis terpenuhi." : "Persyaratan dokumen terpenuhi.");
      setAction(null);
      setFile(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      submitting.current = false;
    }
  }
  async function download(id: string, name: string) {
    setDownloadFailure(null);
    setDownloadId(id);
    try {
      await downloadDocument(id, name);
    } catch (cause) {
      setDownloadFailure({ id, name, message: getApiErrorMessage(cause) });
    } finally {
      setDownloadId(null);
    }
  }
  function link(document: Entity | undefined) {
    if (!document) return "Dokumen belum tersedia";
    if (document.tipePenyimpanan !== "upload_lokal" || typeof document.id !== "string") return <span>{String(document.nama ?? "Dokumen")} (unduh tidak tersedia)</span>;
    const id = document.id;
    const name = String(document.nama ?? "dokumen");
    return (
      <Button type="button" variant="link" disabled={downloadId === id} onClick={() => void download(id, name)}>
        {downloadId === id ? "Mengunduh…" : name}
      </Button>
    );
  }
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <section className="space-y-4" aria-label="Dokumen tahap" aria-busy={locked}>
      {user.isPending ? <p role="status">Memuat peran…</p> : null}
      {user.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(user.error)}{" "}
            <Button type="button" variant="link" onClick={() => void user.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {!detailMatches ? (
        <Alert>
          <AlertDescription>Detail siklus belum tersedia atau tidak sesuai pengadaan. Muat ulang detail sebelum mengubah dokumen.</AlertDescription>
        </Alert>
      ) : null}
      {!active ? <p className="text-sm text-muted-foreground">Tahap tidak aktif; dokumen hanya dapat dilihat.</p> : null}
      {documents.isPending && authenticated ? <p role="status">Memuat dokumen…</p> : null}
      {documents.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(documents.error)}{" "}
            <Button type="button" variant="link" disabled={documents.isFetching || locked} onClick={() => void documents.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {downloadFailure ? (
        <Alert variant="destructive">
          <AlertDescription>
            {downloadFailure.message}{" "}
            <Button variant="link" disabled={Boolean(downloadId)} onClick={() => void download(downloadFailure.id, downloadFailure.name)}>
              Coba unduh lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      <h3 className="font-semibold">Persyaratan tahap {stage.replaceAll("_", " ")}</h3>
      <DataTable
        rows={requirements}
        rowKey={(row) => row.id}
        emptyMessage="Belum ada persyaratan dokumen tahap."
        columns={[
          { key: "jenisDokumen", header: "Jenis dokumen", render: (row) => row.jenisDokumen },
          { key: "wajib", header: "Kewajiban", render: (row) => (row.wajib === true ? "Wajib" : "Opsional") },
          { key: "terpenuhi", header: "Status", render: (row) => (row.terpenuhi === true ? "Terpenuhi" : "Belum terpenuhi") },
          { key: "dokumenId", header: "Dokumen terkait", render: (row) => (documents.isPending ? "Memuat…" : documents.isError ? "Gagal memuat dokumen" : link(linkedDocuments.find((document) => document.id === row.dokumenId))) },
          { key: "catatan", header: "Catatan", render: (row) => String(row.catatan ?? "—") },
          {
            key: "actions",
            header: "Aksi",
            filterable: false,
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {canUpload && uploadStage ? (
                  <Button type="button" variant="outline" disabled={!active || locked} onClick={() => open("upload", row)}>
                    Unggah{row.terpenuhi === true ? " pengganti" : ""}
                  </Button>
                ) : null}
                {canFulfill && stageValid ? (
                  <Button type="button" variant="outline" disabled={!active || locked || documents.isPending || documents.isError || !linkedDocuments.length} onClick={() => open("fulfill", row)}>
                    Tautkan dokumen
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />
      <h3 className="font-semibold">Dokumen pengadaan</h3>
      <p className="text-sm text-muted-foreground">Semua dokumen pengadaan; hubungan tahap ditentukan persyaratan di atas.</p>
      {documents.isPending ? (
        <LoadingState label="Loading..." />
      ) : (
        <DataTable
          rows={linkedDocuments}
          rowKey={(row) => String(row.id)}
          emptyMessage={documents.isError ? "Daftar dokumen gagal dimuat." : "Belum ada dokumen pengadaan."}
          columns={[
            { key: "nama", header: "Nama", render: (row) => link(row) },
            { key: "status", header: "Status", render: (row) => String(row.status ?? "—") },
            { key: "ukuran", header: "Ukuran", render: (row) => (typeof row.ukuran === "number" ? `${(row.ukuran / 1024).toFixed(1)} KB` : "—") },
          ]}
        />
      )}
      <Modal
        open={!!action}
        onClose={close}
        title={action?.mode === "upload" ? "Unggah dokumen tahap" : "Penuhi persyaratan dokumen"}
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" disabled={locked} onClick={close}>
              Batal
            </Button>
            <Button type="submit" form={`${id}-form`} disabled={locked || !permitted || (action?.mode === "fulfill" && (documents.isPending || documents.isError || !documentId))}>
              {locked ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form id={`${id}-form`} onSubmit={submit} className="space-y-4" aria-busy={locked}>
          <p>{requirement?.jenisDokumen ?? "Persyaratan tidak tersedia"}</p>
          {!permitted && action ? (
            <Alert variant="destructive">
              <AlertDescription>Peran, tahap, atau persyaratan berubah. Operasi tidak tersedia.</AlertDescription>
            </Alert>
          ) : null}
          {requirement?.terpenuhi === true ? (
            <Alert>
              <AlertDescription>Operasi mengganti dokumen terkait persyaratan; dokumen lama tetap tersimpan.</AlertDescription>
            </Alert>
          ) : null}
          <fieldset disabled={locked || !permitted} className="space-y-4">
            {action?.mode === "upload" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-name`}>Nama dokumen *</Label>
                  <Input id={`${id}-name`} value={name} required onChange={(event) => setName(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-file`}>File * (maksimal 10 MB)</Label>
                  <Input key={action.requirementId} id={`${id}-file`} type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </div>
                {stage === "delivery" ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${id}-shipment`}>Pengiriman (opsional)</Label>
                      <select id={`${id}-shipment`} className={selectClass} value={shipmentId} onChange={(event) => setShipmentId(event.target.value)}>
                        <option value="">Tanpa pengiriman</option>
                        {shipments.map((row) => (
                          <option key={String(row.id)} value={String(row.id)}>
                            {String(row.nomorBillOfLading ?? row.namaKapal ?? row.id)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${id}-number`}>Nomor dokumen (opsional)</Label>
                      <Input id={`${id}-number`} value={number} onChange={(event) => setNumber(event.target.value)} />
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-document`}>Dokumen pengadaan *</Label>
                  <select id={`${id}-document`} className={selectClass} required value={documentId} disabled={locked || !permitted || documents.isPending || documents.isError} onChange={(event) => setDocumentId(event.target.value)}>
                    <option value="">Pilih dokumen…</option>
                    {linkedDocuments.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {String(row.nama ?? row.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-notes`}>Catatan (opsional)</Label>
                  <Input id={`${id}-notes`} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </div>
              </>
            )}
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

export default LifecycleDocuments;
