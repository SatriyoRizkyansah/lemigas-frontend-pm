"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, FileText, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { getApiErrorMessage } from "@/lib/api/errors";
import { entityText } from "@/components/procurement/EntityListPage";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";

type Jenis = "pengadaan" | "memorandum";
type Step = {
  id: string;
  pengadaanId: string;
  jenis: Jenis;
  urutan: number;
  namaLangkah: string;
  status: string;
  requiredRole?: string | null;
  catatan?: string | null;
  memorandumId?: string | null;
  tanggalKeputusan?: string | null;
  penanggungJawabUser?: { nama?: string; email?: string } | null;
};
type Procurement = {
  id: string;
  nomorSurat?: string | null;
  judul: string;
  status: string;
  diajukanOlehUser?: { nama: string };
  approvalSteps: Step[];
  memorandum?: { id: string; status: string; [key: string]: unknown } | null;
  items?: unknown[];
};
type Inbox = { data: Procurement[]; pagination: { total_datas: number; total_pages: number } };
type Selection = { row: Procurement; jenis: Jenis };
type DecisionValue = "disetujui" | "perlu_revisi" | "ditolak";
type Decision = { pengadaanId: string; stepId: string; decision: DecisionValue; catatan: string };

function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 4 && current && typeof current === "object" && "data" in current; depth++) {
    current = (current as { data: unknown }).data;
  }
  return current;
}
function inboxPayload(value: unknown): Inbox {
  let current = value;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("pagination" in current && "data" in current && Array.isArray(current.data)) return current as Inbox;
    if (!("data" in current)) break;
    current = current.data;
  }
  throw new Error("Response daftar approval tidak valid.");
}
function stepsFor(steps: Step[], jenis: Jenis) {
  return steps.filter((step) => step.jenis === jenis).sort((a, b) => a.urutan - b.urutan);
}
function nextStep(steps: Step[], jenis: Jenis) {
  const ordered = stepsFor(steps, jenis);
  const next = ordered.find((step) => step.status === "menunggu");
  return next && ordered.filter((step) => step.urutan < next.urutan).every((step) => step.status === "disetujui") ? next : undefined;
}
function requiredRole(step?: Step) {
  return step?.requiredRole?.toUpperCase() || (step && step.urutan >= 3 ? "PIMPINAN" : "VERIFIKATOR");
}
function roleAllows(role: string, step?: Step) {
  return Boolean(step && (role === "ADMIN" || role === requiredRole(step)));
}
function workflowWaiting(row: Procurement, jenis: Jenis) {
  return jenis === "memorandum" ? row.memorandum?.status === "menunggu_persetujuan" : ["diajukan", "dalam_review"].includes(row.status);
}
const statusLabels: Record<string, string> = {
  perlu_revisi: "perlu revisi",
  revisi: "perlu revisi",
  ditolak: "ditolak",
};
function Status({ value }: { value: string }) {
  const variant = value === "ditolak" ? "danger" : value === "disetujui" || value === "selesai" ? "ok" : "warn";
  return <StatusBadge status={variant}>{statusLabels[value] ?? value.replaceAll("_", " ")}</StatusBadge>;
}
const hiddenDetailKeys = new Set(["id", "createdAt", "updatedAt", "deletedAt"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function readableLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
function ReadableValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Ya" : "Tidak"}</span>;
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value);
    if (uuidPattern.test(text)) return <span className="text-muted-foreground">—</span>;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return <span>{date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>;
    }
    return <span className="break-words [overflow-wrap:anywhere]">{text}</span>;
  }
  if (Array.isArray(value)) {
    const items = value.filter((item) => !(typeof item === "string" && uuidPattern.test(item)));
    if (items.length === 0) return <span className="text-muted-foreground">Belum ada data.</span>;
    return (
      <div className="mt-2 divide-y divide-border">
        {items.map((item, index) => (
          <div key={index} className="py-3 first:pt-0 last:pb-0">
            <ReadableValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([key, item]) => !hiddenDetailKeys.has(key) && !/(^|_)id$/i.test(key) && !/Id$/.test(key) && !(typeof item === "string" && uuidPattern.test(item)));
    if (!entries.length) return <span className="text-muted-foreground">Tidak ada informasi tambahan.</span>;
    return (
      <dl className={depth === 0 ? "grid gap-x-8 gap-y-4 sm:grid-cols-2" : "grid gap-x-6 gap-y-3 sm:grid-cols-2"}>
        {entries.map(([key, item]) => (
          <div key={key} className={`min-w-0 ${typeof item === "object" && item !== null ? "sm:col-span-2 border-t pt-3 first:border-0 first:pt-0" : ""}`}>
            <dt className="text-xs font-medium text-muted-foreground">{readableLabel(key)}</dt>
            <dd className="mt-1 text-sm leading-6 text-foreground">
              <ReadableValue value={item} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(value)}</span>;
}
function Context({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="group rounded-lg border bg-card">
      <summary className="cursor-pointer list-none px-4 py-3 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          {title}
          <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">
            ⌄
          </span>
        </span>
      </summary>
      <div className="border-t px-4 py-4">
        <ReadableValue value={value} />
      </div>
    </details>
  );
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function MemorandumEvidence({ memorandum, context }: { memorandum: Procurement["memorandum"]; context?: Record<string, unknown> }) {
  const memo = record(memorandum);
  const selection = record(context?.pemilihanPenyedia);
  const vendor = record(selection.vendorTerpilih);
  const evaluation = record(memo.hasilEvaluasi);
  const collective = record(evaluation.rekomendasiKolektif);
  const quorum = record(collective.kuorum);
  return (
    <section className="space-y-3" aria-label="Bukti memorandum">
      <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Snapshot keputusan · hanya baca</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Metode seleksi</dt>
            <dd className="font-medium">{entityText(memo.metodeSeleksi)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vendor rekomendasi</dt>
            <dd className="font-medium">{entityText(vendor.nama) || entityText(record(evaluation.vendorTerpilih).nama)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Kuorum rekomendasi</dt>
            <dd className="font-medium">
              {entityText(quorum.masuk)} / {entityText(quorum.wajib)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status memorandum</dt>
            <dd>
              <Status value={String(memo.status ?? "draft")} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Uraian rekomendasi</dt>
            <dd className="whitespace-pre-wrap font-medium">{entityText(memo.rekomendasi)}</dd>
          </div>
        </dl>
      </div>
      <Context title="Hasil evaluasi dan suara kolektif" value={memo.hasilEvaluasi} />
      <Context title="Analisis harga dan negosiasi" value={memo.analisisHarga} />
      <Context title="Risiko dan mitigasi" value={memo.analisisRisiko} />
      <Context title="Kesiapan pembiayaan" value={memo.kesiapanPembiayaan} />
    </section>
  );
}

type RencanaInboxRow = {
  id: string;
  nomor: string;
  judul: string;
  deskripsi?: string | null;
  status: string;
  modelPelaksanaan?: string | null;
  jenisKargo?: string | null;
  spesifikasiMutu?: unknown;
  volumeMin?: number | null;
  volumeMax?: number | null;
  satuan?: string | null;
  titikSerah?: string | null;
  estimasiMulai?: string | null;
  estimasiSelesai?: string | null;
  penerimaPasokan?: string | null;
  kesiapanPenerima?: unknown;
  jenisTransaksi?: string | null;
  metodeSeleksi?: string | null;
  analisisPasar?: unknown;
  dasarPemilihan?: string | null;
  strategiPengiriman?: string | null;
  strategiPembiayaan?: string | null;
  prioritas?: string | null;
  dibuatOlehUser?: { nama?: string } | null;
  approvalSteps?: { id: string; urutan: number; namaLangkah: string; status: string; catatan?: string | null; tanggalKeputusan?: string | null; penanggungJawabUser?: { nama?: string } | null }[];
};
function RencanaApprovalInbox() {
  const user = useCurrentUser();
  const role = user.data?.role?.toUpperCase() ?? "";
  const [revisions, setRevisions] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const query = use_query<RencanaInboxRow[], Error, void>({
    tag: "rencanaTransaksi",
    method: "perencanaanControllerFindAll",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      const data = unwrap(await apiData(browserApi.ePlanningTransaksi.perencanaanControllerFindAll({ format: "json" }) as Promise<{ data: unknown }>));
      if (!Array.isArray(data)) throw new Error("Response daftar rencana tidak valid.");
      return data as RencanaInboxRow[];
    },
  });
  const pending = (query.data ?? []).flatMap((row) => {
    if (!["diajukan", "dalam_review"].includes(row.status)) return [];
    const steps = [...(row.approvalSteps ?? [])].sort((a, b) => a.urutan - b.urutan);
    const step = steps.find((item) => item.status === "menunggu");
    if (!step || !steps.filter((item) => item.urutan < step.urutan).every((item) => item.status === "disetujui")) return [];
    const requiredRole = step.urutan >= 3 ? "PIMPINAN" : "VERIFIKATOR";
    if (role !== "ADMIN" && role !== requiredRole) return [];
    return [{ row, step, requiredRole }];
  });
  async function decide(row: RencanaInboxRow, stepId: string, decision: "disetujui" | "ditolak") {
    const catatan = revisions[stepId]?.trim() ?? "";
    if (decision === "ditolak" && !catatan) {
      setMessage("Isi alasan revisi sebelum mengirim permintaan revisi.");
      return;
    }
    setBusyId(stepId);
    setMessage("");
    try {
      setBrowserToken();
      await apiData(browserApi.ePlanningTransaksi.perencanaanControllerDecide(row.id, stepId, { decision, catatan }, { format: "json" }) as Promise<{ data: unknown }>);
      setMessage(decision === "disetujui" ? "Tahap rencana berhasil disetujui." : "Rencana dikirim untuk revisi.");
      await query.refetch();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }
  if (query.isPending || user.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getApiErrorMessage(query.error)}{" "}
          <Button type="button" variant="link" size="sm" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </AlertDescription>
      </Alert>
    );
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Rencana transaksi menunggu peran {role || "Anda"}. Hanya tahap aktif yang dapat diputuskan.</p>
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada rencana transaksi yang menunggu validasi Anda.</div>
      ) : (
        pending.map(({ row, step, requiredRole }) => {
          const volume = [row.volumeMin, row.volumeMax]
            .filter((value) => value != null)
            .map((value) => new Intl.NumberFormat("id-ID").format(Number(value)))
            .join(" – ");
          const period = [row.estimasiMulai, row.estimasiSelesai]
            .map((value) => (value ? new Date(value).toLocaleDateString("id-ID") : ""))
            .filter(Boolean)
            .join(" – ");
          const comment = revisions[step.id]?.trim() ?? "";
          return (
            <article key={row.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/20 p-4 sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{row.nomor}</span>
                    {row.prioritas ? <span className="rounded-full bg-background px-2 py-0.5 ring-1 ring-border">Prioritas {row.prioritas.replaceAll("_", " ")}</span> : null}
                  </div>
                  <h3 className="mt-1 text-base font-semibold">{row.judul}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Pemohon: {row.dibuatOlehUser?.nama ?? "—"}</p>
                </div>
                <Status value={row.status} />
              </header>
              <div className="space-y-4 p-4 sm:p-5">
                {row.deskripsi ? <p className="text-sm leading-6 text-muted-foreground">{row.deskripsi}</p> : null}
                <dl className="grid gap-3 rounded-lg border bg-background p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Kargo</dt>
                    <dd className="mt-1 font-medium">{row.jenisKargo || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Volume</dt>
                    <dd className="mt-1 font-medium">{volume ? `${volume} ${row.satuan ?? ""}`.trim() : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Titik serah</dt>
                    <dd className="mt-1 font-medium">{row.titikSerah || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Periode</dt>
                    <dd className="mt-1 font-medium">{period || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Metode seleksi</dt>
                    <dd className="mt-1 font-medium">{row.metodeSeleksi?.replaceAll("_", " ") || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Jenis transaksi</dt>
                    <dd className="mt-1 font-medium">{row.jenisTransaksi?.replaceAll("_", " ") || "—"}</dd>
                  </div>
                </dl>
                <details className="group rounded-lg border bg-background">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center justify-between gap-3">
                      Dasar dan kesiapan rencana{" "}
                      <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-180">
                        ⌄
                      </span>
                    </span>
                  </summary>
                  <div className="grid gap-4 border-t p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Dasar pemilihan</p>
                      <div className="mt-1 text-sm">
                        <ReadableValue value={row.dasarPemilihan} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Penerima pasokan</p>
                      <div className="mt-1 text-sm">
                        <ReadableValue value={row.penerimaPasokan} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Spesifikasi mutu</p>
                      <div className="mt-1 text-sm">
                        <ReadableValue value={row.spesifikasiMutu} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Kesiapan penerima</p>
                      <div className="mt-1 text-sm">
                        <ReadableValue value={row.kesiapanPenerima} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Analisis pasar</p>
                      <div className="mt-1 text-sm">
                        <ReadableValue value={row.analisisPasar} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Strategi pembiayaan</p>
                      <div className="mt-1 text-sm">
                        <ReadableValue value={row.strategiPembiayaan} />
                      </div>
                    </div>
                  </div>
                </details>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Tahap aktif · {requiredRole}</p>
                    <p className="mt-1 font-semibold">
                      {step.urutan}. {step.namaLangkah}
                    </p>
                  </div>
                  <Status value={step.status} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rencana-revisi-${step.id}`}>Catatan keputusan</Label>
                  <Input
                    id={`rencana-revisi-${step.id}`}
                    value={revisions[step.id] ?? ""}
                    disabled={busyId === step.id}
                    placeholder="Wajib diisi bila meminta revisi"
                    onChange={(event) => setRevisions((current) => ({ ...current, [step.id]: event.target.value }))}
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                  <Button type="button" variant="outline" disabled={busyId !== null || !comment} onClick={() => void decide(row, step.id, "ditolak")}>
                    Minta revisi
                  </Button>
                  <Button type="button" disabled={busyId !== null} onClick={() => void decide(row, step.id, "disetujui")}>
                    {busyId === step.id ? "Memproses…" : "Setujui rencana"}
                  </Button>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}

export default function ApprovalPage() {
  const [jenis, setJenis] = useState<Jenis>("pengadaan");
  const [mySubmissions, setMySubmissions] = useState(false);
  const [rencanaInbox, setRencanaInbox] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [catatan, setCatatan] = useState("");
  const [success, setSuccess] = useState("");
  const submitting = useRef(false);
  const client = useQueryClient();
  const user = useCurrentUser();
  const role = user.data?.role?.toUpperCase() ?? "";
  const query = use_query<Inbox, Error, { jenis: Jenis; my: boolean; page: number; limit: number; query: string }>({
    tag: "approval",
    method: mySubmissions ? "approvalGetControllerFindMyPengadaan" : jenis === "pengadaan" ? "approvalGetControllerFindAll" : "approvalGetControllerFindMemorandum",
    params: { jenis, my: mySubmissions, page, limit, query: search.trim() },
    queryFn: async ({ jenis: kind, my, ...params }) => {
      setBrowserToken();
      const request = my
        ? browserApi.approval.approvalGetControllerFindMyPengadaan(params, { format: "json" })
        : kind === "pengadaan"
          ? browserApi.approval.approvalGetControllerFindAll(params, { format: "json" })
          : browserApi.approval.approvalGetControllerFindMemorandum(params, { format: "json" });
      return inboxPayload(await apiData(request as Promise<{ data: unknown }>));
    },
  });
  const history = use_query<Step[], Error, string>({
    tag: "approval",
    method: "approvalGetControllerGetHistory",
    params: selected?.row.id ?? "",
    enabled: Boolean(selected),
    staleTime: 0,
    queryFn: async (id) => {
      setBrowserToken();
      const data = unwrap(await apiData(browserApi.approval.approvalGetControllerGetHistory(id, { format: "json" }) as Promise<{ data: unknown }>));
      if (!Array.isArray(data)) throw new Error("Response riwayat approval tidak valid.");
      return data as Step[];
    },
  });
  const context = use_query<Record<string, unknown>, Error, string>({
    tag: "siklusTransaksiKomoditas",
    method: "transaksiControllerDetail",
    params: selected?.row.id ?? "",
    enabled: Boolean(selected),
    staleTime: 0,
    queryFn: async (id) => {
      setBrowserToken();
      const data = unwrap(await apiData(browserApi.siklusTransaksiKomoditas.transaksiControllerDetail(id, { format: "json" }) as Promise<{ data: unknown }>));
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Response konteks pengadaan tidak valid.");
      return data as Record<string, unknown>;
    },
  });
  const invalidations = ["approval", "siklusTransaksiKomoditas", "pengadaan", "dashboard", "auditLog"].map((tag) => apiQueryKeys.resource(tag));
  const decide = use_mutation<unknown, Error, Decision>({
    tag: "approval",
    method: "approvalActionControllerDecide",
    invalidateKeys: invalidations,
    mutationFn: async ({ pengadaanId, stepId, decision, catatan: comment }) => {
      setBrowserToken();
      return apiData(browserApi.approval.approvalActionControllerDecide(pengadaanId, stepId, { decision, ...(comment.trim() ? { catatan: comment.trim() } : {}) }, { format: "json" }) as Promise<{ data: unknown }>);
    },
    onSuccess: () => {
      setSelected(null);
      setCatatan("");
    },
    onError: () => {
      void Promise.all(invalidations.map((queryKey) => client.invalidateQueries({ queryKey })));
    },
  });
  const activeStep = selected && history.data ? nextStep(history.data, selected.jenis) : undefined;
  const allowed = Boolean(
    selected &&
    !mySubmissions &&
    activeStep?.pengadaanId === selected.row.id &&
    workflowWaiting(selected.row, selected.jenis) &&
    (selected.jenis !== "memorandum" || activeStep?.memorandumId === selected.row.memorandum?.id) &&
    roleAllows(role, activeStep) &&
    user.isSuccess &&
    !user.isFetching &&
    history.isSuccess &&
    !history.isFetching &&
    context.isSuccess &&
    !context.isFetching,
  );
  function open(row: Procurement) {
    decide.reset();
    setCatatan("");
    setSuccess("");
    setSelected({ row, jenis });
  }
  async function submit(decision: Decision["decision"]) {
    if (!allowed || !selected || !activeStep || submitting.current || decide.isPending || (decision !== "disetujui" && !catatan.trim())) return;
    submitting.current = true;
    try {
      await decide.mutateAsync({ pengadaanId: selected.row.id, stepId: activeStep.id, decision, catatan: catatan.trim() });
    } catch {
      /* Mutation error remains visible; retain comment for retry. */
    } finally {
      submitting.current = false;
    }
  }
  function errorAlert(error: unknown, retry: () => void) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getApiErrorMessage(error)}{" "}
          <Button type="button" variant="link" size="sm" onClick={retry}>
            Coba lagi
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  const columns = [
    { key: "nomorSurat", header: "Nomor", render: (row: Procurement) => entityText(row.nomorSurat) },
    { key: "judul", header: "Pengadaan", render: (row: Procurement) => row.judul },
    { key: "pemohon", header: "Pemohon", render: (row: Procurement) => entityText(row.diajukanOlehUser) },
    { key: "status", header: "Status", render: (row: Procurement) => <Status value={jenis === "memorandum" ? (row.memorandum?.status ?? "menunggu") : row.status} /> },
    {
      key: "step",
      header: "Langkah aktif",
      render: (row: Procurement) => {
        const step = nextStep(row.approvalSteps, jenis);
        return step ? `${step.urutan}. ${step.namaLangkah} (${requiredRole(step)})` : "Tidak ada langkah aktif";
      },
    },
    {
      key: "actions",
      header: "Aksi",
      render: (row: Procurement) => (
        <Button type="button" size="sm" variant="outline" disabled={decide.isPending} onClick={() => open(row)}>
          {mySubmissions ? "Detail / riwayat" : "Detail / keputusan"}
        </Button>
      ),
    },
  ];
  return (
    <section className="space-y-6 py-1">
      <PageHeader title="Approval" description="Tinjau pengadaan dan memorandum, atau pantau status pengajuan yang Anda kirim." />
      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardContent className="space-y-5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Pusat persetujuan</h2>
              <p className="mt-1 text-xs text-muted-foreground">Pilih daftar dan jenis dokumen yang ingin ditinjau.</p>
            </div>
            <div className="inline-flex w-fit rounded-lg bg-muted/70 p-1" aria-label="Daftar approval">
              <Button
                type="button"
                className="h-8"
                variant={!mySubmissions ? "default" : "ghost"}
                aria-pressed={!mySubmissions}
                disabled={decide.isPending}
                onClick={() => {
                  setMySubmissions(false);
                  setPage(1);
                }}
              >
                <ClipboardCheck /> Menunggu persetujuan
              </Button>
              <Button
                type="button"
                className="h-8"
                variant={mySubmissions ? "default" : "ghost"}
                aria-pressed={mySubmissions}
                disabled={decide.isPending}
                onClick={() => {
                  setRencanaInbox(false);
                  setMySubmissions(true);
                  setJenis("pengadaan");
                  setPage(1);
                }}
              >
                <Send /> Pengajuan saya
              </Button>
            </div>
          </div>
          {!mySubmissions ? (
            <div className="flex flex-wrap items-center justify-between gap-3" aria-label="Jenis approval">
              <p className="text-sm font-medium text-muted-foreground">Jenis dokumen</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="h-8"
                  variant={rencanaInbox ? "secondary" : "outline"}
                  aria-pressed={rencanaInbox}
                  disabled={decide.isPending}
                  onClick={() => {
                    setRencanaInbox(true);
                    setPage(1);
                  }}
                >
                  <ClipboardCheck /> Rencana transaksi
                </Button>
                {(["pengadaan", "memorandum"] as const).map((kind) => (
                  <Button
                    key={kind}
                    type="button"
                    className="h-8"
                    variant={!rencanaInbox && jenis === kind ? "secondary" : "outline"}
                    aria-pressed={!rencanaInbox && jenis === kind}
                    disabled={decide.isPending}
                    onClick={() => {
                      setRencanaInbox(false);
                      setJenis(kind);
                      setPage(1);
                    }}
                  >
                    {kind === "pengadaan" ? <FileText /> : <ClipboardCheck />}
                    {kind === "pengadaan" ? "Pengadaan" : "Memorandum"}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Semua status pengadaan yang Anda ajukan. Detail dan riwayat hanya baca; daftar ini tidak menyediakan keputusan approval.</p>
          )}
        </CardContent>
      </Card>
      {success && (
        <Alert role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {user.isError &&
        errorAlert(user.error, () => {
          void user.refetch();
        })}
      {!mySubmissions && rencanaInbox ? (
        <RencanaApprovalInbox />
      ) : query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        errorAlert(query.error, () => {
          void query.refetch();
        })
      ) : (
        <DataTable
          key={`${mySubmissions ? "my" : "pending"}:${jenis}`}
          columns={columns}
          rows={query.data?.data ?? []}
          rowKey={(row) => `${jenis}:${row.id}`}
          emptyMessage={mySubmissions ? "Belum ada pengajuan Anda." : "Tidak ada approval menunggu."}
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          remoteSearch
          pagination={{
            page,
            pageSize: limit,
            total: query.data?.pagination.total_datas ?? 0,
            totalPages: Math.max(1, query.data?.pagination.total_pages ?? 1),
            onPageChange: setPage,
            onPageSizeChange: (value) => {
              setLimit(value);
              setPage(1);
            },
          }}
        />
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          if (!decide.isPending && !submitting.current) {
            setSelected(null);
            decide.reset();
          }
        }}
        title={`Detail approval ${selected?.jenis ?? jenis}`}
        footer={
          <>
            <Button type="button" variant="outline" disabled={decide.isPending} onClick={() => setSelected(null)}>
              Tutup
            </Button>
            {!mySubmissions ? (
              <>
                <Button type="button" variant="outline" disabled={!allowed || decide.isPending || !catatan.trim()} onClick={() => void submit("perlu_revisi")}>
                  Minta revisi
                </Button>
                <Button type="button" variant="destructive" disabled={!allowed || decide.isPending || !catatan.trim()} onClick={() => void submit("ditolak")}>
                  Tolak
                </Button>
                <Button type="button" disabled={!allowed || decide.isPending} onClick={() => void submit("disetujui")}>
                  {decide.isPending ? "Memproses…" : "Setujui"}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-foreground">{selected.row.judul}</h2>
              <p>{entityText(selected.row.nomorSurat)}</p>
              <p>Pemohon: {entityText(selected.row.diajukanOlehUser)}</p>
              <Link className="underline" href={`/dashboard/pengadaan/${selected.row.id}/siklus`}>
                Buka siklus pengadaan
              </Link>
            </div>
            {selected.jenis === "pengadaan" && !mySubmissions ? <Context title="Item pengadaan" value={selected.row.items} /> : null}
            {context.isPending ? (
              <LoadingState />
            ) : context.isError ? (
              errorAlert(context.error, () => {
                void context.refetch();
              })
            ) : selected.jenis === "memorandum" ? (
              <MemorandumEvidence memorandum={selected.row.memorandum} context={context.data} />
            ) : (
              <Context title="Konteks siklus pengadaan" value={context.data} />
            )}
            <h3 className="font-semibold text-foreground">Riwayat approval</h3>
            {history.isPending ? (
              <LoadingState />
            ) : history.isError ? (
              errorAlert(history.error, () => {
                void history.refetch();
              })
            ) : (
              <div className="space-y-3">
                {(["pengadaan", "memorandum"] as const).map((kind) => (
                  <div key={kind}>
                    <h4 className="font-medium capitalize">{kind}</h4>
                    {stepsFor(history.data ?? [], kind).length ? (
                      <ol className="space-y-2">
                        {stepsFor(history.data ?? [], kind).map((step) => (
                          <li key={step.id} className="rounded border p-2">
                            <p>
                              {step.urutan}. {step.namaLangkah}
                            </p>
                            <Status value={step.status} />
                            <p>Peran wajib: {requiredRole(step)}</p>
                            <p>Approver: {entityText(step.penanggungJawabUser)}</p>
                            <p>Waktu: {step.tanggalKeputusan ? new Date(step.tanggalKeputusan).toLocaleString("id-ID") : "—"}</p>
                            <p className="whitespace-pre-wrap break-words">Catatan: {step.catatan || "—"}</p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>Belum ada riwayat.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p>
              Role Anda: {role || "Memuat…"}. {activeStep ? `Langkah aktif: ${activeStep.namaLangkah}. Membutuhkan ${requiredRole(activeStep)} atau ADMIN.` : "Tidak ada langkah aktif."}
            </p>
            {mySubmissions ? <p>Pengajuan saya: detail dan riwayat hanya baca.</p> : !allowed && <p>Keputusan terkunci: periksa role, urutan, status workflow, dan pemuatan konteks/riwayat. Status akun tetap diverifikasi server.</p>}
            {!mySubmissions ? (
              <div className="space-y-2">
                <Label htmlFor="approval-comment">Catatan keputusan</Label>
                <Input id="approval-comment" value={catatan} disabled={decide.isPending} onChange={(event) => setCatatan(event.target.value)} aria-describedby="approval-comment-help" />
                <p id="approval-comment-help">Wajib untuk permintaan revisi dan penolakan.</p>
              </div>
            ) : null}
            {decide.isError && (
              <Alert variant="destructive">
                <AlertDescription>{getApiErrorMessage(decide.error)}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
