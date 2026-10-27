"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Download, FileText, PenLine, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { browserApi } from "@/lib/api/browser-client";
import { ContentType } from "@/lib/api/generated/api-generated";
import { VendorAddenda, type Addendum } from "@/components/contracts/ContractAddenda";

type ContractDocument = { id: string; jenis: string; originalName: string };
type ContractSource = {
  rfq?: { id: string; nomor: string; revisi?: number | null } | null;
  penawaran?: {
    id: string;
    nomorRfq?: string | null;
    mataUang: string;
    hargaPenawaran?: string | number | null;
    revisi?: number | null;
    negosiasi?: { putaran: number; hargaHasilNegosiasi?: string | number | null } | null;
  } | null;
};
type Contract = {
  id: string;
  nomor: string;
  pengadaanId: string;
  jenis: string;
  jenisHarga?: string | null;
  formulaHarga?: string | null;
  nilai?: string | number | null;
  mataUang?: string | null;
  titikSerah?: string | null;
  ketentuanPembayaran?: string | null;
  status: string;
  revision: number;
  pengadaan?: { id?: string; nomorSurat?: string | null; judul?: string | null };
  sumberTransaksi?: ContractSource | null;
  dokumen?: ContractDocument[];
  adendum?: Addendum[];
};
type ActionState = { contract: Contract } | null;
type Signer = { nama: string; jabatan: string; email: string; tanggal: string };

const statuses: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral"; message: string }> = {
  menunggu_tanda_tangan_vendor: { label: "Perlu tanda tangan", tone: "warn", message: "Unduh draft, tanda tangani, lalu unggah PDF yang sudah ditandatangani." },
  finalisasi_lemigas: { label: "Finalisasi LEMIGAS", tone: "warn", message: "Dokumen bertanda tangan sudah dikirim dan sedang difinalisasi LEMIGAS." },
  efektif: { label: "Efektif", tone: "ok", message: "Kontrak sudah efektif." },
  dipenuhi: { label: "Selesai", tone: "ok", message: "Kontrak telah selesai dipenuhi." },
  dibatalkan: { label: "Dibatalkan", tone: "danger", message: "Kontrak ini telah dibatalkan." },
  diakhiri: { label: "Diakhiri", tone: "neutral", message: "Kontrak ini telah diakhiri." },
};

function unwrap<T>(value: unknown): T {
  let current = value as any;
  for (let index = 0; index < 4 && current && typeof current === "object" && "data" in current; index += 1) current = current.data;
  return current as T;
}
function amount(value: string | number | null | undefined) {
  if (value == null || value === "") return "—";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(numeric) : String(value);
}
function statusInfo(status: string) {
  return statuses[status] ?? { label: status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()), tone: "neutral" as const, message: "Lihat status terbaru kontrak pada dokumen yang tersedia." };
}
function humanize(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) : "—";
}
function downloadUrl(documentId: string) {
  return `/api/contract-documents/${encodeURIComponent(documentId)}/download`;
}

export function VendorContracts({ selectedContractId, onOpenContract }: { selectedContractId: string | null; onOpenContract: (id?: string) => void }) {
  const contracts = use_query<Contract[], Error, string>({
    tag: "vendor",
    method: "contracts",
    params: "",
    queryFn: async () => {
      setBrowserToken();
      const response = await apiData(browserApi.request({ path: "/api/vendor/me/contracts", method: "GET", secure: true, format: "json" }));
      const data = unwrap<unknown>(response);
      if (!Array.isArray(data)) throw new Error("Daftar kontrak vendor tidak valid.");
      return data as Contract[];
    },
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<ActionState>(null);
  const [file, setFile] = useState<File | null>(null);
  const [signer, setSigner] = useState<Signer>({ nama: "", jabatan: "", email: "", tanggal: "" });
  const rows = contracts.data ?? [];
  const selected = selectedContractId ? rows.find((contract) => contract.id === selectedContractId) : undefined;
  const searchText = search.trim().toLocaleLowerCase("id-ID");
  const filteredRows = rows.filter((contract) => [contract.nomor, contract.pengadaan?.nomorSurat, contract.pengadaan?.judul, contract.sumberTransaksi?.rfq?.nomor, contract.sumberTransaksi?.penawaran?.nomorRfq, statusInfo(contract.status).label]
    .some((value) => value?.toLocaleLowerCase("id-ID").includes(searchText)));
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (dialog) {
      setFile(null);
      setSigner({ nama: "", jabatan: "", email: "", tanggal: "" });
    }
  }, [dialog]);

  const mutation = use_mutation<unknown, Error, NonNullable<ActionState>>({
    tag: "contract",
    method: "command",
    invalidateKeys: [],
    mutationFn: async ({ contract }) => {
      if (!file) throw new Error("Pilih file PDF yang sudah ditandatangani.");
      if (!signer.nama.trim() || !signer.jabatan.trim() || !signer.tanggal) throw new Error("Lengkapi data penandatangan.");
      setBrowserToken();
      const body = new FormData();
      body.append("file", file);
      body.append("expectedRevision", String(contract.revision));
      body.append("penandatanganNama", signer.nama.trim());
      body.append("penandatanganJabatan", signer.jabatan.trim());
      if (signer.email.trim()) body.append("penandatanganEmail", signer.email.trim());
      body.append("tanggalTandaTangan", new Date(signer.tanggal).toISOString());
      const path = `/api/vendor/me/contracts/${encodeURIComponent(contract.pengadaanId)}/${encodeURIComponent(contract.id)}/signed-document`;
      return apiData(browserApi.request({ path, method: "POST", secure: true, type: ContentType.FormData, format: "json", body }));
    },
    onSuccess: () => {
      setDialog(null);
      void contracts.refetch();
    },
  });
  useEffect(() => {
    if (dialog && dialog.contract.id !== selectedContractId && !mutation.isPending) setDialog(null);
  }, [dialog, selectedContractId, mutation.isPending]);

  const selectedStatus = selected ? statusInfo(selected.status) : null;
  const selectedDocuments = selected?.dokumen?.filter((document) => ["approved", "final_signed"].includes(document.jenis)) ?? [];
  const selectedDraft = selectedDocuments.find((document) => document.jenis === "approved");
  const selectedFinal = selectedDocuments.find((document) => document.jenis === "final_signed");
  const sourceOffer = selected?.sumberTransaksi?.penawaran;
  const sourceRfq = selected?.sumberTransaksi?.rfq;
  const dialogDraft = dialog?.contract.dokumen?.find((document) => document.jenis === "approved");

  function closeDialog() {
    if (!mutation.isPending) setDialog(null);
  }

  if (contracts.isPending) return <LoadingState label="Memuat kontrak Anda…" />;
  return (
    <section className="space-y-5">
      {contracts.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>{contracts.error.message}</span><Button type="button" size="sm" variant="outline" onClick={() => void contracts.refetch()}>Coba lagi</Button></div> : null}
      {!selectedContractId ? (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Daftar kontrak</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pilih kontrak untuk melihat pengadaan, dokumen, dan statusnya.</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{rows.length} kontrak</span>
          </header>

          {!rows.length && !contracts.isError ? (
            <div className="rounded-xl border border-dashed bg-muted/10 px-5 py-12 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"><FileText size={21} /></span>
              <h3 className="mt-4 text-sm font-semibold">Belum ada kontrak</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Kontrak yang dikirim kepada perusahaan Anda akan tampil di sini.</p>
            </div>
          ) : rows.length ? (
            <>
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input type="search" aria-label="Cari kontrak" placeholder="Cari nomor kontrak, pengadaan, atau RFQ" className="pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
              </div>
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
                <Table className="min-w-[52rem]">
                  <TableHeader><TableRow><TableHead>Nomor kontrak</TableHead><TableHead>Pengadaan</TableHead><TableHead>RFQ</TableHead><TableHead>Nilai kontrak</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {pageRows.length ? pageRows.map((contract) => {
                      const status = statusInfo(contract.status);
                      return (
                        <TableRow key={contract.id}>
                          <TableCell><p className="font-semibold">{contract.nomor}</p><p className="mt-1 text-xs text-muted-foreground">Revisi {contract.revision}</p></TableCell>
                          <TableCell><p className="font-medium">{contract.pengadaan?.judul ?? "Pengadaan"}</p><p className="mt-1 text-xs text-muted-foreground">{contract.pengadaan?.nomorSurat ?? "—"}</p></TableCell>
                          <TableCell>{contract.sumberTransaksi?.rfq?.nomor ?? contract.sumberTransaksi?.penawaran?.nomorRfq ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium tabular-nums">{contract.mataUang ?? "USD"} {amount(contract.nilai)}</TableCell>
                          <TableCell><span className="whitespace-nowrap"><StatusBadge status={status.tone}>{status.label}</StatusBadge></span></TableCell>
                          <TableCell className="text-right"><Button type="button" size="sm" variant="outline" onClick={() => onOpenContract(contract.id)}>Lihat detail <ChevronRight size={15} /></Button></TableCell>
                        </TableRow>
                      );
                    }) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Tidak ada kontrak yang cocok dengan pencarian.</TableCell></TableRow>}
                  </TableBody>
                </Table>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                  <span>{filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, filteredRows.length)} dari {filteredRows.length} kontrak</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Halaman sebelumnya" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></Button>
                    <span className="min-w-12 text-center">{currentPage} / {totalPages}</span>
                    <Button type="button" variant="outline" size="icon-sm" aria-label="Halaman berikutnya" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></Button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenContract()}><ArrowLeft size={16} /> Kembali ke daftar kontrak</Button>
          {!selected && !contracts.isError ? (
            <div className="rounded-xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">Kontrak tidak ditemukan atau tidak tersedia untuk perusahaan Anda.</div>
          ) : selected && selectedStatus ? (
            <Card className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="flex flex-col gap-3 border-b bg-muted/15 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Nomor kontrak · Revisi {selected.revision}</p>
                  <CardTitle className="mt-1 break-words text-xl">{selected.nomor}</CardTitle>
                  <p className="mt-2 text-sm text-muted-foreground">{selected.pengadaan?.judul ?? "Pengadaan"} · {selected.pengadaan?.nomorSurat ?? "—"}</p>
                </div>
                <StatusBadge status={selectedStatus.tone}>{selectedStatus.label}</StatusBadge>
              </CardHeader>
              <CardContent className="space-y-6 p-4 sm:p-5">
                <section className="space-y-3">
                  <div><h3 className="text-sm font-semibold">Asal transaksi</h3><p className="mt-1 text-xs text-muted-foreground">RFQ, penawaran, dan negosiasi yang terkait dengan kontrak.</p></div>
                  <dl className="divide-y overflow-hidden rounded-lg border text-sm">
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                      <dt className="text-muted-foreground">RFQ</dt>
                      <dd className="font-medium">{sourceRfq?.nomor ?? sourceOffer?.nomorRfq ?? "Tidak tersedia"}{sourceRfq?.revisi ? ` · Revisi ${sourceRfq.revisi}` : ""}</dd>
                      {sourceRfq?.id ? <dd><Link className="text-xs font-medium text-primary underline underline-offset-2" href={`/dashboard/vendor-portal?section=rfq&rfq=${encodeURIComponent(sourceRfq.id)}`}>Lihat RFQ</Link></dd> : null}
                    </div>
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                      <dt className="text-muted-foreground">Penawaran Anda</dt>
                      <dd className="font-medium tabular-nums">{sourceOffer ? `${sourceOffer.mataUang} ${amount(sourceOffer.hargaPenawaran)} per satuan${sourceOffer.revisi ? ` · Revisi ${sourceOffer.revisi}` : ""}` : "Data penawaran tidak tersedia"}</dd>
                    </div>
                    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                      <dt className="text-muted-foreground">Hasil negosiasi</dt>
                      <dd className="font-medium tabular-nums">{sourceOffer?.negosiasi ? `${sourceOffer.mataUang} ${amount(sourceOffer.negosiasi.hargaHasilNegosiasi)} per satuan · Putaran ${sourceOffer.negosiasi.putaran} disepakati` : sourceOffer ? "Belum ada hasil negosiasi disepakati" : "Data negosiasi tidak tersedia"}</dd>
                    </div>
                  </dl>
                </section>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Informasi kontrak</h3>
                  <dl className="grid overflow-hidden rounded-lg border sm:grid-cols-2">
                    {[["Jenis kontrak", humanize(selected.jenis)], ["Jenis harga", humanize(selected.jenisHarga)], ["Nilai kontrak", `${selected.mataUang ?? "USD"} ${amount(selected.nilai)}`], ["Titik serah", selected.titikSerah || "—"]].map(([label, value], index) => <div key={label} className={`min-w-0 px-4 py-3 ${index > 0 ? "border-t" : ""} ${index === 1 ? "sm:border-t-0" : ""} ${index % 2 === 1 ? "sm:border-l" : ""}`}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}
                    {selected.formulaHarga ? <div className="min-w-0 border-t px-4 py-3 sm:col-span-2"><dt className="text-xs text-muted-foreground">Formula harga</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{selected.formulaHarga}</dd></div> : null}
                    {selected.ketentuanPembayaran ? <div className="min-w-0 border-t px-4 py-3 sm:col-span-2"><dt className="text-xs text-muted-foreground">Ketentuan pembayaran</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{selected.ketentuanPembayaran}</dd></div> : null}
                  </dl>
                </section>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Dokumen kontrak</h3>
                  {selectedDocuments.length ? <div className="grid gap-2 sm:grid-cols-2">
                    {selectedDraft ? <a className="flex min-h-12 items-center gap-3 rounded-lg border bg-background p-3 text-sm hover:bg-muted/30" href={downloadUrl(selectedDraft.id)} target="_blank" rel="noreferrer"><Download size={17} className="shrink-0 text-primary" /><span className="min-w-0"><span className="block font-medium">Draft untuk ditandatangani</span><span className="block truncate text-xs text-muted-foreground">{selectedDraft.originalName}</span></span></a> : null}
                    {selectedFinal ? <a className="flex min-h-12 items-center gap-3 rounded-lg border bg-background p-3 text-sm hover:bg-muted/30" href={downloadUrl(selectedFinal.id)} target="_blank" rel="noreferrer"><FileText size={17} className="shrink-0 text-emerald-600" /><span className="min-w-0"><span className="block font-medium">Kontrak final</span><span className="block truncate text-xs text-muted-foreground">{selectedFinal.originalName}</span></span></a> : null}
                  </div> : <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Belum ada dokumen kontrak yang tersedia.</p>}
                </section>
                <VendorAddenda addenda={selected.adendum ?? []} pengadaanId={selected.pengadaanId} contractId={selected.id} onRefresh={() => void contracts.refetch()} />
              </CardContent>
              <CardFooter className="flex-col items-start justify-between gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">{selected.status === "menunggu_tanda_tangan_vendor" ? <PenLine size={16} className="mt-0.5 shrink-0 text-amber-600" /> : selected.status === "efektif" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" /> : <Clock3 size={16} className="mt-0.5 shrink-0" />}<span>{selectedStatus.message}</span></p>
                {selected.status === "menunggu_tanda_tangan_vendor" ? <Button type="button" className="w-full sm:w-auto" onClick={() => { mutation.reset(); setDialog({ contract: selected }); }}><Upload size={16} /> Unggah kontrak bertanda tangan</Button> : null}
              </CardFooter>
            </Card>
          ) : null}
        </>
      )}

      <Modal open={Boolean(dialog)} onClose={closeDialog} title="Kirim kontrak bertanda tangan" description={dialog ? `${dialog.contract.nomor} · ${dialog.contract.pengadaan?.judul ?? "Pengadaan"}` : undefined} size="lg" footer={<><Button type="button" variant="outline" onClick={closeDialog} disabled={mutation.isPending}>Batal</Button><Button type="submit" form="contract-action-form" disabled={mutation.isPending || !file || !signer.nama.trim() || !signer.jabatan.trim() || !signer.tanggal}>{mutation.isPending ? "Mengirim…" : "Kirim untuk finalisasi"}</Button></>}>
        <form id="contract-action-form" onSubmit={(event: FormEvent) => { event.preventDefault(); if (dialog) mutation.mutate(dialog); }} className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-3 text-sm"><FileText size={18} className="mt-0.5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-medium">Periksa draft kontrak sebelum menandatangani.</p>{dialogDraft ? <a className="mt-1 inline-flex items-center gap-1 text-primary underline underline-offset-2" href={downloadUrl(dialogDraft.id)} target="_blank" rel="noreferrer">Unduh draft kontrak</a> : <p className="mt-1 text-muted-foreground">Dokumen draft belum tersedia.</p>}</div></div>
          <section className="space-y-3"><h3 className="text-sm font-semibold">Data penandatangan</h3><div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="vendor-signer-name">Nama penandatangan <span className="text-destructive">*</span></Label><Input id="vendor-signer-name" required value={signer.nama} disabled={mutation.isPending} onChange={(event) => setSigner({ ...signer, nama: event.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="vendor-signer-title">Jabatan <span className="text-destructive">*</span></Label><Input id="vendor-signer-title" required value={signer.jabatan} disabled={mutation.isPending} onChange={(event) => setSigner({ ...signer, jabatan: event.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="vendor-signer-email">Email (opsional)</Label><Input id="vendor-signer-email" type="email" value={signer.email} disabled={mutation.isPending} onChange={(event) => setSigner({ ...signer, email: event.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="vendor-signer-date">Tanggal tanda tangan <span className="text-destructive">*</span></Label><Input id="vendor-signer-date" type="date" required value={signer.tanggal} disabled={mutation.isPending} onChange={(event) => setSigner({ ...signer, tanggal: event.target.value })} /></div>
          </div></section>
          <section className="space-y-2"><Label htmlFor="vendor-signed-contract">PDF kontrak bertanda tangan <span className="text-destructive">*</span></Label><label htmlFor="vendor-signed-contract" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/10 px-4 py-5 text-center transition-colors hover:bg-muted/30"><Upload size={20} className="text-muted-foreground" /><span className="text-sm font-medium">{file?.name ?? "Pilih file PDF yang sudah ditandatangani"}</span><span className="text-xs text-muted-foreground">PDF, maksimal 20 MB</span></label><Input id="vendor-signed-contract" className="sr-only" type="file" accept="application/pdf,.pdf" required disabled={mutation.isPending} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></section>
          {mutation.error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{mutation.error.message}</p> : null}
        </form>
      </Modal>
    </section>
  );
}
