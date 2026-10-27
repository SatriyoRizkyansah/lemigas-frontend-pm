"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { Modal } from "@/components/modal/Modal";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdendumApprovals } from "@/components/contracts/ContractAddenda";

type Review = {
  keputusan: string;
  catatan?: string | null;
  checklist?: Record<string, boolean>;
  dokumen?: { id: string; originalName: string };
};
type Contract = {
  id: string;
  pengadaanId: string;
  nomor: string;
  jenis: string;
  jenisHarga?: string | null;
  formulaHarga?: string | null;
  revision: number;
  nilai?: number | string | null;
  mataUang?: string;
  ketentuanPembayaran?: string | null;
  titikSerah?: string | null;
  status: string;
  vendor?: { id: string; nama?: string | null } | null;
  pengadaan?: { id: string; nomorSurat: string; judul: string };
  reviews?: Review[];
  dokumen?: Array<{ id: string; jenis: string; originalName: string }>;
};
type Decision = { contract: Contract; decision: "disetujui" | "revisi" };

const checklistLabels: Record<string, string> = {
  pihakSesuai: "Pihak kontrak sesuai",
  objekDanVolumeSesuai: "Objek dan volume sesuai",
  hargaSesuai: "Harga sesuai",
  jadwalDanTitikSerahSesuai: "Jadwal dan titik serah sesuai",
  ketentuanPembayaranSesuai: "Ketentuan pembayaran sesuai",
  risikoDanKewenanganSesuai: "Risiko dan kewenangan sesuai",
};

function unwrap<T>(value: unknown): T {
  let current = value as any;
  for (let i = 0; i < 4 && current && typeof current === "object" && "data" in current; i++) current = current.data;
  return current as T;
}

function formatAmount(value: number | string | null | undefined) {
  if (value == null || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(amount) : String(value);
}

function checklistLabel(key: string) {
  return checklistLabels[key] ?? key.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function ContractApprovals() {
  const role = useCurrentUser().data?.role?.toLowerCase();
  const [selected, setSelected] = useState<Contract | null>(null);
  const [revisionMode, setRevisionMode] = useState(false);
  const [note, setNote] = useState("");
  const approvals = use_query<Contract[], Error, string>({
    tag: "contract",
    method: "approvals",
    params: "inbox",
    queryFn: async () => {
      setBrowserToken();
      return unwrap<Contract[]>(await apiData(browserApi.request({ path: "/api/contract-approvals", method: "GET", secure: true, format: "json" })));
    },
  });
  const mutation = use_mutation<unknown, Error, Decision>({
    tag: "contract",
    method: "decision",
    invalidateKeys: [apiQueryKeys.resource("contract"), apiQueryKeys.resource("notifikasi"), apiQueryKeys.resource("auditLog")],
    mutationFn: async ({ contract, decision }) => {
      setBrowserToken();
      return apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(contract.pengadaanId)}/contracts/${encodeURIComponent(contract.id)}/decision`,
          method: "POST",
          secure: true,
          type: "application/json" as any,
          format: "json",
          body: { expectedRevision: contract.revision, decision, ...(decision === "revisi" ? { catatan: note.trim() } : {}) },
        }),
      );
    },
    onSuccess: () => {
      setSelected(null);
      setRevisionMode(false);
      setNote("");
      void approvals.refetch();
    },
  });

  if (role !== "admin" && role !== "pimpinan") return <p className="text-sm text-muted-foreground">Akses persetujuan kontrak khusus Admin dan Pimpinan.</p>;
  if (approvals.isPending) return <LoadingState label="Memuat persetujuan kontrak…" />;

  const selectedReview = selected?.reviews?.find((item) => item.keputusan === "menunggu");
  const selectedDocument = selectedReview?.dokumen ?? selected?.dokumen?.find((item) => item.jenis === "draft");
  const selectedChecklist = Object.entries(selectedReview?.checklist ?? {});

  function closeDetails() {
    if (mutation.isPending) return;
    setSelected(null);
    setRevisionMode(false);
    setNote("");
    mutation.reset();
  }

  function openDetails(contract: Contract) {
    mutation.reset();
    setNote("");
    setRevisionMode(false);
    setSelected(contract);
  }

  function submitDecision(decision: Decision["decision"]) {
    if (!selected || mutation.isPending || (decision === "revisi" && !note.trim())) return;
    mutation.mutate({ contract: selected, decision });
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Persetujuan kontrak</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buka detail draft dan checklist sebelum memberi keputusan.</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{approvals.data?.length ?? 0} menunggu</span>
      </header>

      {approvals.error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{approvals.error.message}</p>
      ) : null}

      {!approvals.data?.length ? (
        <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada kontrak yang menunggu persetujuan.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[660px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor kontrak</TableHead>
                  <TableHead>Pengadaan</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Nilai kontrak</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.data.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.nomor}</TableCell>
                    <TableCell>
                      <div className="max-w-[19rem]">
                        <p className="font-medium">{contract.pengadaan?.judul ?? "Pengadaan"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{contract.pengadaan?.nomorSurat ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{contract.vendor?.nama ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{contract.mataUang ?? "USD"} {formatAmount(contract.nilai)}</TableCell>
                    <TableCell><StatusBadge status="warn">Menunggu persetujuan</StatusBadge></TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openDetails(contract)}>Lihat detail</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <AdendumApprovals />

      <Modal
        open={Boolean(selected)}
        onClose={closeDetails}
        title={selected ? `Detail kontrak ${selected.nomor}` : "Detail kontrak"}
        description={selected?.pengadaan ? `${selected.pengadaan.nomorSurat} · ${selected.pengadaan.judul}` : "Periksa informasi dan dokumen kontrak sebelum memberi keputusan."}
        size="lg"
        bodyClassName="space-y-5"
        footer={
          <>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={closeDetails}>{revisionMode ? "Batal" : "Tutup"}</Button>
            {selected && !revisionMode ? (
              <>
                <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => { setNote(""); setRevisionMode(true); }}>
                  Minta revisi
                </Button>
                <Button type="button" disabled={mutation.isPending} onClick={() => submitDecision("disetujui")}>
                  {mutation.isPending ? "Memproses…" : "Setujui"}
                </Button>
              </>
            ) : selected ? (
              <Button type="button" variant="destructive" disabled={mutation.isPending || !note.trim()} onClick={() => submitDecision("revisi")}>
                {mutation.isPending ? "Mengirim…" : "Kirim permintaan revisi"}
              </Button>
            ) : null}
          </>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <section className="overflow-hidden rounded-lg border">
              <dl className="divide-y text-sm">
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-muted-foreground">Vendor</dt>
                  <dd className="font-medium">{selected.vendor?.nama ?? "—"}</dd>
                </div>
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-muted-foreground">Jenis kontrak</dt>
                  <dd className="font-medium">{selected.jenis.replaceAll("_", " ")}</dd>
                </div>
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-muted-foreground">Jenis harga</dt>
                  <dd className="font-medium">{selected.jenisHarga?.replaceAll("_", " ") ?? "—"}</dd>
                </div>
                <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                  <dt className="text-muted-foreground">Nilai kontrak</dt>
                  <dd className="font-medium tabular-nums">{selected.mataUang ?? "USD"} {formatAmount(selected.nilai)}</dd>
                </div>
                {selected.formulaHarga ? (
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-muted-foreground">Formula harga</dt>
                    <dd className="whitespace-pre-wrap font-medium">{selected.formulaHarga}</dd>
                  </div>
                ) : null}
                {selected.ketentuanPembayaran ? (
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-muted-foreground">Ketentuan pembayaran</dt>
                    <dd className="whitespace-pre-wrap font-medium">{selected.ketentuanPembayaran}</dd>
                  </div>
                ) : null}
                {selected.titikSerah ? (
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-muted-foreground">Titik serah</dt>
                    <dd className="whitespace-pre-wrap font-medium">{selected.titikSerah}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Checklist pemeriksaan</h3>
                <StatusBadge status="warn">Menunggu persetujuan</StatusBadge>
              </div>
              {selectedChecklist.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {selectedChecklist.map(([key, checked]) => (
                    <li key={key} className="flex items-center gap-2 rounded-md border bg-muted/15 px-3 py-2 text-sm">
                      <span className={checked ? "font-semibold text-emerald-600" : "font-semibold text-destructive"} aria-hidden="true">{checked ? "✓" : "×"}</span>
                      <span>{checklistLabel(key)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">Checklist pemeriksaan tidak tersedia.</p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Dokumen draft</h3>
              {selectedDocument ? (
                <a className="flex items-center justify-between gap-3 rounded-md border bg-muted/15 px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted/35" href={`/api/contract-documents/${encodeURIComponent(selectedDocument.id)}/download`} target="_blank" rel="noreferrer">
                  <span className="min-w-0 truncate">{selectedDocument.originalName}</span>
                  <span className="shrink-0 text-xs underline">Buka PDF</span>
                </a>
              ) : (
                <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">PDF draft belum tersedia.</p>
              )}
            </section>

            {revisionMode ? (
              <section className="space-y-2 rounded-lg border border-amber-300/70 bg-amber-50/50 p-3 dark:bg-amber-950/10">
                <Label htmlFor="contract-review-note">Catatan revisi <span className="text-destructive">*</span></Label>
                <textarea
                  id="contract-review-note"
                  autoFocus
                  className="min-h-24 w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  placeholder="Jelaskan bagian yang perlu diperbaiki..."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  disabled={mutation.isPending}
                />
                <p className="text-xs text-muted-foreground">Catatan ini akan dikirim ke pengaju bersama permintaan revisi.</p>
              </section>
            ) : null}

            {mutation.error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{mutation.error.message}</p> : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
