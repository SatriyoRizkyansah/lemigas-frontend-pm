"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { getApiErrorMessage } from "@/lib/api/errors";
import { downloadDocument } from "@/lib/api/download";
import { dateText, entityText } from "@/components/procurement/EntityListPage";
import { LifecycleDocuments } from "@/components/workflow/LifecycleDocuments";
import { LoadingState } from "@/components/loading/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/table/DataTable";
import { Modal } from "@/components/modal/Modal";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { documentAccept, uploadDocument, validateDocumentFile } from "./document-upload";

type Entity = Record<string, unknown> & { id: string };
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && "data" in current; depth++) current = object(current).data;
  return current;
}
function rows(value: unknown): Entity[] {
  if (!Array.isArray(value)) throw new Error("Respons daftar tidak valid.");
  return value.filter((row): row is Entity => typeof object(row).id === "string");
}
async function request(request: Promise<unknown>): Promise<unknown> {
  return apiData(request as Promise<{ data: unknown }>);
}
const stages = ["perencanaan", "sourcing", "evaluasi_negosiasi", "approval", "kontrak", "delivery", "settlement", "selesai", "gagal", "dibatalkan"];
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function DokumenPage() {
  const client = useQueryClient();
  const user = useCurrentUser();
  const role = String(object(unwrap(user.data)).role ?? "").toLowerCase();
  const authenticated = !user.isPending && !user.isError && !!role;
  const canUpload = authenticated && ["admin", "operator"].includes(role);
  const canDelete = authenticated && role === "admin";
  const [procurementId, setProcurementId] = useState("");
  const [procurementSearch, setProcurementSearch] = useState("");
  const [procurementPage, setProcurementPage] = useState(1);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [stage, setStage] = useState("perencanaan");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploadProcurementId, setUploadProcurementId] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Entity | null>(null);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [success, setSuccess] = useState("");
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const uploadLock = useRef(false);
  const deleteLock = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  useEffect(() => () => uploadAbort.current?.abort(), []);

  const procurements = use_query<{ rows: Entity[]; totalPages: number }, Error, { query: string; page: number }>({
    tag: "pengadaan",
    method: "dokumenProcurementOptions",
    params: { query: procurementSearch, page: procurementPage },
    enabled: authenticated,
    queryFn: async (params) => {
      setBrowserToken();
      const payload = await request(browserApi.pengadaan.pengadaanGetControllerFindAll({ ...params, limit: 25 }, { format: "json" }));
      return { rows: rows(unwrap(payload)), totalPages: Number(object(object(payload).pagination).total_pages ?? 1) };
    },
  });
  const documents = use_query<{ rows: Entity[]; total: number; totalPages: number }, Error, { procurementId: string; query: string; page: number; limit: number }>({
    tag: "dokumen",
    method: "documentManagementList",
    params: { procurementId, query: search, page, limit },
    enabled: authenticated,
    queryFn: async (params) => {
      setBrowserToken();
      if (params.procurementId) {
        const payload = await request(browserApi.dokumen.dokumenGetControllerFindByPengadaan(params.procurementId, { format: "json" }));
        const list = rows(unwrap(payload)).filter((row) => row.pengadaanId === params.procurementId);
        return { rows: list, total: list.length, totalPages: 1 };
      }
      const payload = await request(browserApi.dokumen.dokumenGetControllerFindAll({ query: params.query || undefined, page: params.page, limit: params.limit }, { format: "json" }));
      const list = rows(unwrap(payload));
      const pagination = object(object(payload).pagination);
      return { rows: list, total: Number(pagination.total_datas ?? list.length), totalPages: Number(pagination.total_pages ?? 1) };
    },
  });
  const lifecycle = use_query<Record<string, unknown>, Error, string>({
    tag: "siklusTransaksiKomoditas",
    method: "transaksiControllerDetail",
    params: procurementId,
    enabled: authenticated && !!procurementId,
    queryFn: async (id) => {
      setBrowserToken();
      const detail = object(unwrap(await request(browserApi.siklusTransaksiKomoditas.transaksiControllerDetail(id, { format: "json" }))));
      if (detail.id !== id) throw new Error("Detail siklus tidak sesuai pengadaan.");
      return detail;
    },
  });
  const stageRows = Array.isArray(lifecycle.data?.tahapan) ? lifecycle.data.tahapan : [];
  const activeStage = stageRows.some((row) => object(row).tahap === stage && object(row).status === "aktif");
  const busy = uploading || deleting;
  async function refresh() {
    await Promise.all(["dokumen", "pengadaan", "siklusTransaksiKomoditas"].map((tag) => client.invalidateQueries({ queryKey: apiQueryKeys.resource(tag) })));
  }
  function openUpload() {
    setUploadProcurementId(procurementId);
    setName("");
    setFile(null);
    setProgress(null);
    setUploadError("");
    setSuccess("");
    setUploadOpen(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadLock.current || !canUpload) return;
    setUploadError("");
    setSuccess("");
    try {
      validateDocumentFile(file);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploadProcurementId)) throw new Error("Pilih pengadaan yang valid.");
      if (!name.trim() || name.trim().length > 200) throw new Error("Nama wajib diisi, maksimal 200 karakter.");
      uploadLock.current = true;
      setUploading(true);
      setProgress(null);
      const controller = new AbortController();
      uploadAbort.current = controller;
      await uploadDocument({ file, pengadaanId: uploadProcurementId, nama: name.trim(), tipePenyimpanan: "upload_lokal" }, setProgress, controller.signal);
      setUploadOpen(false);
      setFile(null);
      setSuccess("Dokumen tersimpan. Unggah umum tidak otomatis memenuhi persyaratan; tautkan melalui panel dokumen wajib.");
    } catch (cause) {
      setUploadError(getApiErrorMessage(cause));
    } finally {
      uploadLock.current = false;
      uploadAbort.current = null;
      setUploading(false);
      // Network failure/abort can occur after server saved file. Always refresh.
      await refresh();
    }
  }
  async function remove() {
    if (!deleteTarget || deleteLock.current || !canDelete) return;
    deleteLock.current = true;
    setDeleting(true);
    setError("");
    setSuccess("");
    try {
      setBrowserToken();
      await request(browserApi.dokumen.dokumenDeleteControllerRemove(deleteTarget.id, { format: "json" }));
      setDeleteTarget(null);
      setSuccess("Dokumen dihapus.");
    } catch (cause) {
      setError(getApiErrorMessage(cause));
      setDeleteTarget(null);
    } finally {
      deleteLock.current = false;
      setDeleting(false);
      await refresh();
    }
  }
  async function download(row: Entity) {
    if (typeof row.id !== "string" || downloadId) return;
    setError("");
    setDownloadId(row.id);
    try {
      await downloadDocument(row.id, entityText(row.nama) || "dokumen");
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setDownloadId(null);
    }
  }
  function retryError(message: string, retry: () => unknown) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {message}{" "}
          <Button type="button" variant="link" onClick={() => void retry()}>
            Coba lagi
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <section className="space-y-5 py-1">
      <PageHeader
        title="Dokumen"
        description="Berkas pengadaan dan kelengkapan dokumen wajib."
        actions={
          <Button type="button" disabled={!canUpload || busy} onClick={openUpload}>
            Unggah dokumen
          </Button>
        }
      />
      {user.isPending ? <LoadingState label="Loading..." /> : null}
      {user.isError ? retryError(getApiErrorMessage(user.error), user.refetch) : null}
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-3 rounded-lg border p-4">
        <Label htmlFor="procurement-search">Cari pengadaan</Label>
        <Input
          id="procurement-search"
          value={procurementSearch}
          disabled={!authenticated || busy}
          onChange={(event) => {
            setProcurementSearch(event.target.value);
            setProcurementPage(1);
          }}
          placeholder="Cari judul / nomor pengadaan…"
        />
        {procurements.isError ? retryError(getApiErrorMessage(procurements.error), procurements.refetch) : null}
        <Label htmlFor="procurement-filter">Filter pengadaan</Label>
        <select
          id="procurement-filter"
          className={selectClass}
          value={procurementId}
          disabled={!authenticated || busy}
          onChange={(event) => {
            setProcurementId(event.target.value);
            setPage(1);
            setSearch("");
          }}
        >
          <option value="">Semua pengadaan</option>
          {procurementId && !procurements.data?.rows.some((row) => row.id === procurementId) ? <option value={procurementId}>{procurementId} (dipilih)</option> : null}
          {procurements.data?.rows.map((row) => (
            <option key={row.id} value={row.id}>
              {entityText(row.nomorSurat)} — {entityText(row.judul)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={busy || procurements.isFetching || procurementPage <= 1} onClick={() => setProcurementPage((value) => value - 1)}>
            Sebelumnya
          </Button>
          <span className="text-sm" role="status">
            {procurements.isFetching ? "Memuat pengadaan…" : `Halaman pengadaan ${procurementPage}`}
          </span>
          <Button type="button" variant="outline" disabled={busy || !procurements.data || procurements.isFetching || procurementPage >= procurements.data.totalPages} onClick={() => setProcurementPage((value) => value + 1)}>
            Berikutnya
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Filter memakai endpoint by-pengadaan. Pencarian dokumen pengadaan dilakukan lokal; daftar semua memakai paginasi server.</p>
      </div>
      {documents.isPending && authenticated ? <LoadingState label="Loading..." /> : null}
      {documents.isError ? retryError(getApiErrorMessage(documents.error), documents.refetch) : null}
      {authenticated && !documents.isPending && !documents.isError ? (
        <DataTable<Entity>
          key={procurementId || "all"}
          rows={documents.data?.rows ?? []}
          rowKey={(row) => row.id}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Cari nama dokumen…"
          pagination={
            !procurementId
              ? {
                  page,
                  pageSize: limit,
                  total: documents.data?.total ?? 0,
                  totalPages: documents.data?.totalPages,
                  onPageChange: setPage,
                  onPageSizeChange: (value) => {
                    setLimit(value);
                    setPage(1);
                  },
                }
              : undefined
          }
          emptyMessage="Belum ada dokumen sesuai pencarian."
          columns={[
            { key: "nama", header: "Dokumen", render: (row) => entityText(row.nama) },
            { key: "pengadaanId", header: "Pengadaan", render: (row) => entityText(object(row.pengadaan).judul ?? row.pengadaanId) },
            { key: "diunggahOleh", header: "Pengunggah", render: (row) => entityText(object(row.diunggahOlehUser).nama ?? row.diunggahOleh) },
            { key: "createdAt", header: "Diunggah", render: (row) => dateText(row.createdAt) },
            { key: "updatedAt", header: "Diperbarui", render: (row) => dateText(row.updatedAt) },
            { key: "ukuran", header: "Ukuran", render: (row) => (typeof row.ukuran === "number" ? `${(row.ukuran / 1024).toFixed(1)} KB` : "—") },
            { key: "status", header: "Status server", render: (row) => entityText(row.status) },
            { key: "tipePenyimpanan", header: "Penyimpanan", render: (row) => entityText(row.tipePenyimpanan) },
            {
              key: "attachment",
              header: "Lampiran",
              filterable: false,
              render: (row) =>
                row.tipePenyimpanan === "upload_lokal" ? (
                  <Button type="button" variant="link" disabled={downloadId === row.id} onClick={() => void download(row)}>
                    {downloadId === row.id ? "Mengunduh…" : "Unduh"}
                  </Button>
                ) : (
                  "Unduh tidak tersedia"
                ),
            },
            {
              key: "actions",
              header: "Aksi",
              filterable: false,
              render: (row) =>
                canDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setDeleteTarget(row);
                    }}
                  >
                    Hapus
                  </Button>
                ) : (
                  "Hanya baca"
                ),
            },
          ]}
        />
      ) : null}
      {procurementId ? (
        <section className="space-y-4 rounded-lg border p-4" aria-label="Dokumen wajib pengadaan">
          <h2 className="font-semibold">Dokumen wajib per pengadaan</h2>
          <Label htmlFor="document-stage">Tahap persyaratan</Label>
          <select id="document-stage" className={selectClass} value={stage} onChange={(event) => setStage(event.target.value)}>
            {stages.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {lifecycle.isPending ? <p role="status">Memuat persyaratan…</p> : null}
          {lifecycle.isError ? retryError(getApiErrorMessage(lifecycle.error), lifecycle.refetch) : null}
          <p className="text-sm text-muted-foreground">
            Unggah umum di atas menyediakan validasi tipe dan progres. Gunakan Tautkan dokumen untuk memenuhi persyaratan pada tahap aktif. Unggah tahap memakai komponen lifecycle yang sudah ada.
          </p>
          {!lifecycle.isPending && !lifecycle.isError && lifecycle.data ? <LifecycleDocuments pengadaanId={procurementId} stage={stage} active={activeStage && !lifecycle.isFetching} detail={lifecycle.data} /> : null}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Pilih pengadaan untuk memeriksa dan memenuhi dokumen wajib.</p>
      )}
      <Modal
        open={uploadOpen}
        onClose={() => {
          if (!uploadLock.current) setUploadOpen(false);
        }}
        title="Unggah dokumen"
        description="Pilih pengadaan, isi nama dokumen, lalu unggah file."
        size="md"
        footer={
          <>
            <Button type="button" variant="outline" disabled={uploading} onClick={() => setUploadOpen(false)}>
              Batal
            </Button>
            <Button type="submit" form="document-upload-form" disabled={uploading || !canUpload}>
              {uploading ? "Mengunggah…" : "Unggah"}
            </Button>
          </>
        }
      >
        <form id="document-upload-form" onSubmit={submit} className="space-y-4" aria-busy={uploading}>
          <fieldset disabled={uploading || !canUpload} className="space-y-3">
            <Label htmlFor="upload-procurement">Pengadaan *</Label>
            <select id="upload-procurement" className={selectClass} required value={uploadProcurementId} onChange={(event) => setUploadProcurementId(event.target.value)}>
              <option value="">Pilih pengadaan…</option>
              {uploadProcurementId && !procurements.data?.rows.some((row) => row.id === uploadProcurementId) ? <option value={uploadProcurementId}>{uploadProcurementId}</option> : null}
              {procurements.data?.rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {entityText(row.judul)}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">Pilihan mengikuti pencarian dan halaman pengadaan di luar dialog.</p>
            <Label htmlFor="document-name">Nama dokumen *</Label>
            <Input id="document-name" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
            <Label htmlFor="document-file">File * (maksimal 10 MB)</Label>
            <Input
              key={String(uploadOpen)}
              id="document-file"
              type="file"
              required
              accept={documentAccept}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(null);
                setUploadError("");
                try {
                  validateDocumentFile(selected);
                  setFile(selected);
                } catch (cause) {
                  setUploadError(getApiErrorMessage(cause));
                  event.target.value = "";
                }
              }}
            />
            <p className="text-sm text-muted-foreground">PDF, Word, Excel, JPG, PNG. Validasi browser bukan pemindaian keamanan; backend belum memvalidasi MIME/konten.</p>
          </fieldset>
          {uploading ? (
            <div role="status" aria-live="polite">
              <progress className="w-full" max={100} value={progress ?? undefined} aria-label="Progres unggah" />
              <p>{progress === 100 ? "File terkirim; menunggu konfirmasi server…" : progress === null ? "Mengirim file…" : `${progress}% terkirim`}</p>
            </div>
          ) : null}
          {uploadError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => {
          if (!deleteLock.current) setDeleteTarget(null);
        }}
        onConfirm={() => void remove()}
        title="Hapus dokumen"
        message={`Hapus dokumen “${String(deleteTarget?.nama ?? "")}” beserta file lokal? Tindakan tidak dapat dibatalkan. Backend dapat menghapus file sebelum penghapusan metadata gagal; periksa ulang dokumen setelah kegagalan.`}
        confirmLabel="Hapus permanen"
        busy={deleting}
      />
    </section>
  );
}
