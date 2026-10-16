"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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

type Jenis = "pengadaan" | "memorandum";
type Step = {
  id: string;
  pengadaanId: string;
  jenis: Jenis;
  urutan: number;
  namaLangkah: string;
  status: string;
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
type Decision = { pengadaanId: string; stepId: string; decision: "disetujui" | "ditolak"; catatan: string };

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
function roleAllows(role: string, step?: Step) {
  return Boolean(step && (role === "ADMIN" || role === (step.urutan >= 3 ? "PIMPINAN" : "VERIFIKATOR")));
}
function workflowWaiting(row: Procurement, jenis: Jenis) {
  return jenis === "memorandum" ? row.memorandum?.status === "menunggu_persetujuan" : ["diajukan", "dalam_review"].includes(row.status);
}
function Status({ value }: { value: string }) {
  return <StatusBadge status={value === "ditolak" ? "danger" : value === "disetujui" || value === "selesai" ? "ok" : "warn"}>{value.replaceAll("_", " ")}</StatusBadge>;
}
function Context({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{value == null ? "Belum ada data." : JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export default function ApprovalPage() {
  const [jenis, setJenis] = useState<Jenis>("pengadaan");
  const [mySubmissions, setMySubmissions] = useState(false);
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
      return apiData(browserApi.approval.approvalActionControllerDecide(pengadaanId, stepId, { decision, catatan: comment.trim() }, { format: "json" }) as Promise<{ data: unknown }>);
    },
    onSuccess: (_, variables) => {
      setSuccess(variables.decision === "disetujui" ? "Langkah approval berhasil disetujui." : "Langkah approval berhasil ditolak.");
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
    if (!allowed || !selected || !activeStep || submitting.current || decide.isPending || (decision === "ditolak" && !catatan.trim())) return;
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
        return step ? `${step.urutan}. ${step.namaLangkah} (${step.urutan >= 3 ? "PIMPINAN" : "VERIFIKATOR"})` : "Tidak ada langkah aktif";
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
    <section className="space-y-5 py-1">
      <PageHeader
        title="Approval"
        description="Inbox pengadaan dan memorandum menunggu persetujuan, serta status pengajuan saya. Keputusan mengikuti role dan urutan langkah."
        actions={
          <Button type="button" variant="outline" disabled={query.isFetching || decide.isPending} onClick={() => void query.refetch()}>
            Muat ulang
          </Button>
        }
      />
      <div className="flex gap-2" aria-label="Daftar approval">
        <Button
          type="button"
          variant={!mySubmissions ? "default" : "outline"}
          aria-pressed={!mySubmissions}
          disabled={decide.isPending}
          onClick={() => {
            setMySubmissions(false);
            setPage(1);
          }}
        >
          Menunggu persetujuan
        </Button>
        <Button
          type="button"
          variant={mySubmissions ? "default" : "outline"}
          aria-pressed={mySubmissions}
          disabled={decide.isPending}
          onClick={() => {
            setMySubmissions(true);
            setJenis("pengadaan");
            setPage(1);
          }}
        >
          Pengajuan saya
        </Button>
      </div>
      {mySubmissions && <p className="text-sm text-muted-foreground">Semua status pengadaan yang Anda ajukan. Detail dan riwayat hanya baca; daftar ini tidak menyediakan keputusan approval.</p>}
      {!mySubmissions && (
        <div className="flex gap-2" aria-label="Jenis approval">
          {(["pengadaan", "memorandum"] as const).map((kind) => (
            <Button
              key={kind}
              type="button"
              variant={jenis === kind ? "default" : "outline"}
              aria-pressed={jenis === kind}
              disabled={decide.isPending}
              onClick={() => {
                setJenis(kind);
                setPage(1);
              }}
            >
              {kind === "pengadaan" ? "Pengadaan" : "Memorandum"}
            </Button>
          ))}
        </div>
      )}
      {success && (
        <Alert role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {user.isError &&
        errorAlert(user.error, () => {
          void user.refetch();
        })}
      {query.isPending ? (
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
            {!mySubmissions && (
              <>
                <Button type="button" disabled={!allowed || decide.isPending} onClick={() => void submit("disetujui")}>
                  {decide.isPending ? "Memproses…" : "Setujui langkah"}
                </Button>
                <Button type="button" variant="destructive" disabled={!allowed || decide.isPending || !catatan.trim()} onClick={() => void submit("ditolak")}>
                  Tolak langkah
                </Button>
              </>
            )}
          </>
        }
      >
        {selected && (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <h2 className="font-semibold text-foreground">{selected.row.judul}</h2>
              <p>{entityText(selected.row.nomorSurat)}</p>
              <p>Pemohon: {entityText(selected.row.diajukanOlehUser)}</p>
              <Link className="underline" href={`/dashboard/pengadaan/${selected.row.id}/siklus`}>
                Buka siklus pengadaan
              </Link>
            </div>
            {!mySubmissions && <Context title="Item pengadaan" value={selected.row.items} />}
            {selected.jenis === "memorandum" && <Context title="Memorandum keputusan" value={selected.row.memorandum} />}
            {context.isPending ? (
              <LoadingState />
            ) : context.isError ? (
              errorAlert(context.error, () => {
                void context.refetch();
              })
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
              Role Anda: {role || "Memuat…"}. {activeStep ? `Langkah aktif: ${activeStep.namaLangkah}. Membutuhkan ${activeStep.urutan >= 3 ? "PIMPINAN" : "VERIFIKATOR"} atau ADMIN.` : "Tidak ada langkah aktif."}
            </p>
            {mySubmissions ? <p>Pengajuan saya: detail dan riwayat hanya baca.</p> : !allowed && <p>Keputusan terkunci: periksa role, urutan, status workflow, dan pemuatan konteks/riwayat. Status akun tetap diverifikasi server.</p>}
            {!mySubmissions && (
              <div className="space-y-2">
                <Label htmlFor="approval-comment">Catatan keputusan (wajib untuk penolakan)</Label>
                <Input id="approval-comment" value={catatan} disabled={decide.isPending} onChange={(event) => setCatatan(event.target.value)} aria-describedby="approval-comment-help" />
                <p id="approval-comment-help">Penolakan tidak menerima catatan kosong atau hanya spasi.</p>
              </div>
            )}
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
