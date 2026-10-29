"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileUp,
  Send,
  Clock3,
  FileText,
  CircleCheck,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { Modal } from "@/components/modal/Modal";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { EmptyData } from "@/components/loading/EmptyData";
import { Button } from "@/components/ui/Button";
import { UploadDocumentField } from "@/components/documents/DocumentControls";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { VendorContracts } from "@/components/contracts/VendorContracts";

type VendorDoc = {
  id: string;
  jenis: string;
  status: string;
  filePath: string;
  expiresAt?: string | null;
};
type Portal = {
  id: string;
  status: string;
  rejectionReason?: string | null;
  revision?: unknown;
  vendor: {
    id: string;
    nama: string;
    alamat?: string | null;
    telepon?: string | null;
    email?: string | null;
    npwp?: string | null;
    contactPerson?: string | null;
    vendorDocuments: VendorDoc[];
  };
};
type VendorOffer = {
  id: string;
  nomorRfq?: string | null;
  hargaPenawaran?: number | string | null;
  mataUang: string;
  berlakuSampai?: string | null;
  syaratPembayaran?: string | null;
  ketentuanPengangkutan?: string | null;
  detail?: Record<string, unknown> | null;
  status: string;
  revisi?: number;
  isCurrent?: boolean;
  submittedAt?: string | null;
  updatedAt?: string | null;
  dokumenPenawaran?: Array<{
    requirementId: string;
    dokumen: { id: string; nama: string; filePath: string };
  }>;
};
type RfqDocumentRequirement = {
  id: string;
  nama: string;
  wajib?: boolean;
  keterangan?: string;
};
type Rfq = {
  id: string;
  penawaran?: VendorOffer[];
  nomor: string;
  revisi?: number;
  revisiDariId?: string | null;
  alasanPerubahan?: string | null;
  batasRespons?: string | null;
  volume?: number | string | null;
  satuan?: string | null;
  titikSerah?: string | null;
  syaratPembayaran?: string | null;
  syaratPenyerahan?: string | null;
  spesifikasi?: Record<string, unknown> | null;
  dokumenDiminta?: RfqDocumentRequirement[] | null;
  ketentuan?: Record<string, unknown> | null;
  pengadaan: { id: string; nomorSurat: string; judul: string; status: string };
};
const DOCUMENT_TYPES = [
  { value: "NIB", label: "NIB" },
  { value: "LEGALITAS", label: "LEGALITAS" },
  { value: "NPWP", label: "NPWP" },
  { value: "AKTA_PERUSAHAAN", label: "Akta Perusahaan" },
  { value: "SURAT_DOMISILI", label: "Surat Domisili" },
  { value: "REKENING_BANK", label: "Rekening Bank" },
  {
    value: "SURAT_KUASA_PENUNJUKAN_PENANDATANGAN",
    label: "Surat Kuasa / Penunjukan Penandatangan",
  },
] as const;
const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPES.map(({ value }) => value);

type Negotiation = {
  id: string;
  putaran: number;
  hargaHasilNegosiasi?: string | number | null;
  hasil?: string | null;
  status:
    | "menunggu_tanggapan"
    | "disepakati"
    | "ditolak"
    | "digantikan"
    | "dibatalkan";
  tanggapanVendor?: string | null;
  catatanVendor?: string | null;
  alasanPenutupan?: string | null;
  penawaran: {
    id?: string;
    hargaPenawaran?: string | number | null;
    mataUang: string;
    nomorRfq?: string | null;
    syaratPembayaran?: string | null;
    ketentuanPengangkutan?: string | null;
    berlakuSampai?: string | null;
    status?: string;
    detail?: Record<string, unknown> | null;
    pengadaan: { id: string; nomorSurat: string; judul: string };
  };
};
const NEGOTIATION_STATUS_LABELS: Record<Negotiation["status"], string> = {
  menunggu_tanggapan: "Menunggu tanggapan",
  disepakati: "Disepakati",
  ditolak: "Ditolak",
  digantikan: "Digantikan putaran baru",
  dibatalkan: "Diakhiri tanpa kesepakatan",
};
const negotiationStatusClass = (status: Negotiation["status"]) =>
  status === "menunggu_tanggapan"
    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
    : status === "disepakati"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : status === "ditolak"
        ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
        : "bg-muted text-muted-foreground";
const API = process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001";
function token() {
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return readSession(raw)?.token;
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message ?? `Request gagal (${response.status})`);
  return payload;
}

function normalizedRfqTerm(key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : value;
}
function formatRfqValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (Array.isArray(value))
    return (
      value
        .map(formatRfqValue)
        .filter((item) => item !== "—")
        .join(", ") || "—"
    );
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = ["value", "label", "nama", "name", "text", "detail"];
    const simple = preferred.find(
      (key) =>
        record[key] !== undefined &&
        (typeof record[key] !== "object" || record[key] === null),
    );
    if (simple) return formatRfqValue(record[simple]);
    return (
      Object.entries(record)
        .filter(
          ([, item]) => item !== null && item !== undefined && item !== "",
        )
        .map(
          ([key, item]) =>
            `${key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}: ${formatRfqValue(item)}`,
        )
        .join(" · ") || "—"
    );
  }
  return String(value);
}
function rfqTermLabel(key: string): string {
  const labels: Record<string, string> = {
    satuan: "Satuan",
    volume: "Volume",
    titikSerah: "Titik serah",
    spesifikasi: "Spesifikasi",
    dokumenDiminta: "Dokumen diminta",
    syaratPembayaran: "Syarat pembayaran",
    syaratPenyerahan: "Syarat penyerahan",
  };
  return (
    labels[key] ??
    key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())
  );
}
function structuredRows(value: unknown): Array<[string, unknown]> | null {
  if (Array.isArray(value)) {
    const rows = value.map(
      (item, index) => [String(index + 1), item] as [string, unknown],
    );
    return rows.length ? rows : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = ["value", "label", "nama", "name", "text", "detail"];
    if (
      preferred.some(
        (key) =>
          record[key] !== undefined &&
          (typeof record[key] !== "object" || record[key] === null),
      )
    )
      return null;
    const rows = Object.entries(record).filter(
      ([, item]) => item !== null && item !== undefined && item !== "",
    );
    return rows.length ? rows : null;
  }
  if (typeof value === "string" && value.includes(":")) {
    const rows = value
      .split(/\\r?\\n|\\s+·\\s+/)
      .map((part) => {
        const separator = part.indexOf(":");
        return separator < 0
          ? null
          : ([
              part.slice(0, separator).trim(),
              part.slice(separator + 1).trim(),
            ] as [string, unknown]);
      })
      .filter((row): row is [string, unknown] =>
        Boolean(row && row[0] && row[1]),
      );
    return rows.length ? rows : null;
  }
  return null;
}
function NegotiationList({
  negotiations,
  rfqs,
  onSelect,
  formatAmount,
}: {
  negotiations: Negotiation[];
  rfqs: Rfq[];
  onSelect: (id: string) => void;
  formatAmount: (value: number, code: string) => string;
}) {
  return (
    <section id="negosiasi" className="space-y-5 scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Daftar negosiasi
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Setiap baris menunjukkan satu putaran negosiasi beserta RFQ dan
            penawaran yang terkait.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
          {negotiations.length} negosiasi
        </span>
      </div>
      {!negotiations.length ? (
        <EmptyData
          className="min-h-48 border-border/70 bg-card/70 shadow-sm"
          label="Belum ada negosiasi untuk ditanggapi."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[58rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Pengadaan</TableHead>
                  <TableHead>RFQ &amp; penawaran</TableHead>
                  <TableHead>Putaran</TableHead>
                  <TableHead>Permintaan harga</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {negotiations.map((item) => {
                  const itemRfq = rfqs.find(
                    (rfq) =>
                      rfq.nomor === item.penawaran.nomorRfq ||
                      rfq.id === item.penawaran.nomorRfq,
                  );
                  const baseline = item.penawaran.detail?.rfqBaseline as
                    Record<string, unknown> | undefined;
                  const unit = String(
                    baseline?.satuan ?? itemRfq?.satuan ?? "",
                  );
                  const initial = Number(item.penawaran.hargaPenawaran);
                  const requested = Number(item.hargaHasilNegosiasi);
                  const itemPrice = (
                    value: string | number | null | undefined,
                    fallback: string,
                  ) =>
                    value != null &&
                    value !== "" &&
                    Number.isFinite(Number(value))
                      ? `${item.penawaran.mataUang} ${formatAmount(Number(value), item.penawaran.mataUang)}${unit ? ` / ${unit}` : ""}`
                      : fallback;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${negotiationStatusClass(item.status)}`}
                        >
                          {NEGOTIATION_STATUS_LABELS[item.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="min-w-40 font-medium">
                          {item.penawaran.pengadaan.judul}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.penawaran.pengadaan.nomorSurat}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="whitespace-nowrap font-medium">
                          {itemRfq?.nomor ??
                            item.penawaran.nomorRfq ??
                            "RFQ tidak tersedia"}
                        </p>
                        <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                          Penawaran:{" "}
                          {itemPrice(
                            item.penawaran.hargaPenawaran,
                            "Belum tersedia",
                          )}
                        </p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        Putaran {item.putaran}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium">
                        {itemPrice(item.hargaHasilNegosiasi, "Belum ada harga")}
                        {Number.isFinite(initial) &&
                        initial > 0 &&
                        Number.isFinite(requested) ? (
                          <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                            {(((requested - initial) / initial) * 100).toFixed(
                              1,
                            )}
                            % dari penawaran
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSelect(item.id)}
                        >
                          Buka detail <ChevronRight size={15} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </section>
  );
}

function NegotiationWorkspace({
  negotiations,
  rfqs,
  selectedId,
  onSelect,
  busy,
  onRespond,
  onBack,
  formatAmount,
}: {
  negotiations: Negotiation[];
  rfqs: Rfq[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  busy: boolean;
  onRespond: (
    item: Negotiation,
    response: "diterima" | "ditolak",
    catatan?: string,
  ) => Promise<void>;
  formatAmount: (value: number, code: string) => string;
}) {
  const selected = negotiations.find((item) => item.id === selectedId);
  const [responseNote, setResponseNote] = useState("");
  useEffect(() => setResponseNote(""), [selected?.id]);
  if (!selectedId)
    return (
      <NegotiationList
        negotiations={negotiations}
        rfqs={rfqs}
        onSelect={onSelect}
        formatAmount={formatAmount}
      />
    );
  if (!selected)
    return (
      <section className="space-y-4">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft size={16} /> Kembali ke daftar negosiasi
        </Button>
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Negosiasi tidak ditemukan atau tidak tersedia untuk perusahaan Anda.
        </div>
      </section>
    );

  const linkedRfq = rfqs.find(
    (rfq) =>
      rfq.nomor === selected.penawaran.nomorRfq ||
      rfq.id === selected.penawaran.nomorRfq,
  );
  const baseline = selected.penawaran.detail?.rfqBaseline as
    Record<string, unknown> | undefined;
  const initial = Number(selected.penawaran.hargaPenawaran);
  const negotiated = Number(selected.hargaHasilNegosiasi);
  const unit = String(baseline?.satuan ?? linkedRfq?.satuan ?? "");
  const price = (value: string | number | null | undefined) => {
    if (value == null || value === "") return "Belum tersedia";
    const numeric = Number(value);
    return `${selected.penawaran.mataUang} ${Number.isFinite(numeric) ? formatAmount(numeric, selected.penawaran.mataUang) : value}${unit ? ` / ${unit}` : ""}`;
  };
  const offerDetails = selected.penawaran.detail ?? {};
  const excludedKeys = new Set(["rfqBaseline"]);
  const offerRows = Object.entries(offerDetails).filter(
    ([key, value]) =>
      !excludedKeys.has(key) &&
      value !== null &&
      value !== undefined &&
      value !== "",
  );
  const rfqRows: Array<[string, unknown]> = linkedRfq
    ? (
        [
          [
            "Volume",
            linkedRfq.volume
              ? `${linkedRfq.volume}${linkedRfq.satuan ? ` ${linkedRfq.satuan}` : ""}`
              : null,
          ],
          ["Titik serah", linkedRfq.titikSerah],
          ["Spesifikasi", linkedRfq.spesifikasi],
          ["Syarat pembayaran", linkedRfq.syaratPembayaran],
          ["Syarat penyerahan", linkedRfq.syaratPenyerahan],
          ["Batas respons", linkedRfq.batasRespons],
          [
            "Dokumen diminta",
            linkedRfq.dokumenDiminta?.map((doc) => doc.nama).join(", "),
          ],
        ] as Array<[string, unknown]>
      ).filter(
        ([, value]) => value !== null && value !== undefined && value !== "",
      )
    : [];
  const display = (value: unknown) => formatRfqValue(value);

  return (
    <section className="space-y-5">
      <Button type="button" variant="outline" size="sm" onClick={onBack}>
        <ArrowLeft size={16} /> Kembali ke daftar negosiasi
      </Button>
      <article className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 bg-gradient-to-r from-primary/[0.07] via-muted/30 to-transparent px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Rincian negosiasi · Putaran {selected.putaran}
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              {selected.penawaran.pengadaan.judul}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nomor pengadaan: {selected.penawaran.pengadaan.nomorSurat}{" "}
              <span aria-hidden="true">·</span> RFQ:{" "}
              {selected.penawaran.nomorRfq ?? "—"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${negotiationStatusClass(selected.status)}`}
          >
            {NEGOTIATION_STATUS_LABELS[selected.status]}
          </span>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          <section className="rounded-xl border bg-muted/15 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Jejak dokumen terkait
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">RFQ</p>
                <p className="truncate text-sm font-semibold">
                  {linkedRfq?.nomor ??
                    selected.penawaran.nomorRfq ??
                    "Tidak tersedia"}
                </p>
              </div>
              <ChevronRight
                className="mx-auto hidden text-muted-foreground sm:block"
                size={16}
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Penawaran Anda</p>
                <p className="truncate text-sm font-semibold">
                  {price(selected.penawaran.hargaPenawaran)}
                </p>
              </div>
              <ChevronRight
                className="mx-auto hidden text-muted-foreground sm:block"
                size={16}
              />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Negosiasi</p>
                <p className="truncate text-sm font-semibold">
                  Putaran {selected.putaran} ·{" "}
                  {price(selected.hargaHasilNegosiasi)}
                </p>
              </div>
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              <div>
                <h4 className="font-semibold">Detail RFQ</h4>
                <p className="text-xs text-muted-foreground">
                  Ketentuan permintaan penawaran untuk pengadaan ini
                </p>
              </div>
            </div>
            {linkedRfq ? (
              <>
                <div className="mb-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Nomor RFQ</p>
                    <p className="mt-1 font-semibold">{linkedRfq.nomor}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Batas respons
                    </p>
                    <p className="mt-1 font-medium">
                      {linkedRfq.batasRespons
                        ? new Date(linkedRfq.batasRespons).toLocaleString(
                            "id-ID",
                          )
                        : "Tidak dicantumkan"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Volume kebutuhan
                    </p>
                    <p className="mt-1 font-medium">
                      {linkedRfq.volume ?? "—"} {linkedRfq.satuan ?? ""}
                    </p>
                  </div>
                </div>
                <dl className="grid gap-2 rounded-xl bg-muted/30 p-4 sm:grid-cols-2">
                  {rfqRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="border-b border-border/50 py-2 last:border-0"
                    >
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm font-medium">
                        {display(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Detail RFQ tidak tersedia pada data negosiasi ini. Nomor RFQ
                tercatat: {selected.penawaran.nomorRfq ?? "—"}.
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                2
              </span>
              <div>
                <h4 className="font-semibold">Detail penawaran vendor</h4>
                <p className="text-xs text-muted-foreground">
                  Penawaran awal yang Anda kirim untuk RFQ tersebut
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Harga penawaran awal
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {price(selected.penawaran.hargaPenawaran)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Syarat pembayaran
                </p>
                <p className="mt-2 text-sm font-medium">
                  {selected.penawaran.syaratPembayaran ??
                    linkedRfq?.syaratPembayaran ??
                    "Tidak dicantumkan"}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Ketentuan pengangkutan
                </p>
                <p className="mt-2 text-sm font-medium">
                  {selected.penawaran.ketentuanPengangkutan ??
                    "Tidak dicantumkan"}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Masa berlaku penawaran
                </p>
                <p className="mt-2 text-sm font-medium">
                  {selected.penawaran.berlakuSampai
                    ? new Date(selected.penawaran.berlakuSampai).toLocaleString(
                        "id-ID",
                      )
                    : "Tidak dicantumkan"}
                </p>
              </div>
            </div>
            {offerRows.length > 0 && (
              <dl className="mt-3 grid gap-2 rounded-xl bg-muted/30 p-4 sm:grid-cols-2">
                {offerRows.map(([key, value]) => (
                  <div
                    key={key}
                    className="border-b border-border/50 py-2 last:border-0"
                  >
                    <dt className="text-xs text-muted-foreground">
                      {key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (char) => char.toUpperCase())}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm">
                      {display(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                3
              </span>
              <div>
                <h4 className="font-semibold">Permintaan negosiasi</h4>
                <p className="text-xs text-muted-foreground">
                  Periksa harga dan catatan sebelum memberi keputusan
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Harga awal
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums">
                  {price(selected.penawaran.hargaPenawaran)}
                </p>
              </div>
              <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Harga yang diminta
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-primary">
                  {price(selected.hargaHasilNegosiasi)}
                </p>
                {Number.isFinite(initial) &&
                  initial > 0 &&
                  Number.isFinite(negotiated) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Perubahan{" "}
                      {(((negotiated - initial) / initial) * 100).toFixed(1)}%
                      dari harga awal
                    </p>
                  )}
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-muted/40 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Catatan tim pengadaan
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {selected.hasil || "Tidak ada catatan tambahan."}
              </p>
            </div>
            <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
              {selected.status === "menunggu_tanggapan" ? (
                <>
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">
                      Catatan tanggapan (opsional)
                    </span>
                    <textarea
                      value={responseNote}
                      onChange={(event) => setResponseNote(event.target.value)}
                      maxLength={4000}
                      rows={3}
                      disabled={busy}
                      className="w-full rounded-md border bg-background px-3 py-2"
                      placeholder="Tambahkan alasan, klarifikasi, atau syarat tanggapan"
                    />
                  </label>
                  <div className="flex w-full gap-2 sm:justify-end">
                    <Button
                      type="button"
                      className="flex-1 sm:flex-none"
                      disabled={busy}
                      onClick={() =>
                        void onRespond(
                          selected,
                          "diterima",
                          responseNote.trim() || undefined,
                        )
                      }
                    >
                      <CircleCheck size={16} /> Setujui harga
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      disabled={busy}
                      onClick={() =>
                        void onRespond(
                          selected,
                          "ditolak",
                          responseNote.trim() || undefined,
                        )
                      }
                    >
                      Tolak
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Status:{" "}
                  <strong className="text-foreground">
                    {NEGOTIATION_STATUS_LABELS[selected.status]}
                  </strong>
                  {selected.catatanVendor
                    ? ` · Catatan Anda: ${selected.catatanVendor}`
                    : ""}
                  {selected.alasanPenutupan
                    ? ` · Alasan penutupan: ${selected.alasanPenutupan}`
                    : ""}
                </p>
              )}
            </div>
          </section>
        </div>
      </article>
    </section>
  );
}

function VendorPortalView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedSection = searchParams?.get("section");
  const selectedRfqId = searchParams?.get("rfq");
  const selectedContractId = searchParams?.get("contract") ?? null;
  const selectedNegotiationId = searchParams?.get("negotiation") ?? null;
  const openRfq = (rfqId?: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("section", "rfq");
    params.delete("negotiation");
    if (rfqId) params.set("rfq", rfqId);
    else params.delete("rfq");
    router.push(`/dashboard/vendor-portal?${params.toString()}`, {
      scroll: false,
    });
  };
  const openContract = (contractId?: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("section", "contracts");
    params.delete("rfq");
    params.delete("negotiation");
    if (contractId) params.set("contract", contractId);
    else params.delete("contract");
    router.push(`/dashboard/vendor-portal?${params.toString()}`, {
      scroll: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const openNegotiation = (negotiationId?: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("section", "negotiation");
    params.delete("rfq");
    params.delete("contract");
    if (negotiationId) params.set("negotiation", negotiationId);
    else params.delete("negotiation");
    router.push(`/dashboard/vendor-portal?${params.toString()}`, {
      scroll: false,
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const section =
    selectedSection === "rfq"
      ? "rfq"
      : selectedSection === "negotiation"
        ? "negotiation"
        : selectedSection === "contracts"
          ? "contracts"
          : "profile";
  const [profile, setProfile] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [filesByType, setFilesByType] = useState<Record<string, File | null>>(
    {},
  );
  const { toast } = useToast();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [quoteModalRfqId, setQuoteModalRfqId] = useState<string | null>(null);
  const currencyConfig: Record<
    string,
    { prefix: string; locale: string; currency: string }
  > = {
    IDR: { prefix: "Rp", locale: "id-ID", currency: "IDR" },
    USD: { prefix: "$", locale: "en-US", currency: "USD" },
    RUB: { prefix: "₽", locale: "ru-RU", currency: "RUB" },
  };
  const formatAmount = (value: number, code: string) =>
    new Intl.NumberFormat(currencyConfig[code]?.locale ?? "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(value);
  const [quoteAmount, setQuoteAmount] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await request<{ data: Portal }>(
        "/api/vendor-onboarding/me",
      );
      setProfile(result.data);
      if (result.data.status === "approved") {
        const [list, negotiationList] = await Promise.all([
          request<{ data: Rfq[] }>("/api/vendor-onboarding/me/rfqs"),
          request<{ data: Negotiation[] }>(
            "/api/vendor-onboarding/me/negotiations",
          ),
        ]);
        setRfqs(list.data ?? []);
        setNegotiations(negotiationList.data ?? []);
      } else {
        setRfqs([]);
        setNegotiations([]);
      }
    } catch (e) {
      toast({
        title: "Gagal memuat portal",
        description: e instanceof Error ? e.message : "Gagal memuat portal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const prior = rfqs.find((item) => item.id === selectedRfqId)
      ?.penawaran?.[0];
    setQuoteCurrency(prior?.mataUang ?? "USD");
    setQuoteAmount(
      prior?.hargaPenawaran == null ? "" : String(prior.hargaPenawaran),
    );
  }, [rfqs, selectedRfqId]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      const result = await request<{ message?: string }>(
        "/api/vendor-onboarding/me/profile",
        { method: "PUT", body: JSON.stringify(values) },
      );
      const message = result.message || "Profil tersimpan.";
      setNotice(message);
      window.dispatchEvent(
        new CustomEvent("api:success", { detail: { message } }),
      );
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Profil gagal disimpan";
      toast({
        title: "Profil gagal disimpan",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }
  async function uploadDocument(jenis: string) {
    const file = filesByType[jenis];
    if (!file) {
      toast({
        title: "Dokumen belum dipilih",
        description: `Pilih file untuk dokumen ${jenis}.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    setNotice("");
    const form = new FormData();
    form.append("file", file);
    form.append("jenis", jenis);
    try {
      const result = await request<{ message?: string }>(
        "/api/vendor-onboarding/me/documents",
        { method: "POST", body: form },
      );
      const message = result.message || `${jenis} berhasil diunggah.`;
      setFilesByType((current) => ({ ...current, [jenis]: null }));
      setNotice(message);
      window.dispatchEvent(
        new CustomEvent("api:success", { detail: { message } }),
      );
      await refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : `Dokumen ${jenis} gagal diunggah`;
      toast({
        title: "Unggah dokumen gagal",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }
  async function submitOnboarding() {
    setBusy(true);
    setNotice("");
    try {
      const result = await request<{ message?: string }>(
        "/api/vendor-onboarding/me/submit",
        { method: "POST" },
      );
      const message = result.message || "Onboarding dikirim untuk review.";
      setNotice(message);
      window.dispatchEvent(
        new CustomEvent("api:success", { detail: { message } }),
      );
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Pengajuan gagal";
      toast({
        title: "Pengajuan gagal",
        description: message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    try {
      const response = await fetch(
        `${API}/api/vendor-onboarding/documents/${id}/file`,
        { headers: { Authorization: `Bearer ${token()}` } },
      );
      if (!response.ok) throw new Error("File tidak dapat diunduh");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `dokumen-${id}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Unduh gagal",
        description: e instanceof Error ? e.message : "Unduh gagal",
        variant: "destructive",
      });
    }
  }
  async function respondNegotiation(
    item: Negotiation,
    tanggapan: "diterima" | "ditolak",
    catatan?: string,
  ) {
    setBusy(true);
    setNotice("");
    try {
      await request(
        `/api/vendor-onboarding/me/negotiations/${item.id}/respond`,
        {
          method: "POST",
          body: JSON.stringify({ tanggapan, catatan }),
        },
      );
      setNotice(`Negosiasi putaran ${item.putaran} ${tanggapan}.`);
      await refresh();
    } catch (e) {
      toast({
        title: "Tanggapan negosiasi gagal",
        description:
          e instanceof Error ? e.message : "Tanggapan negosiasi gagal disimpan",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>, rfq: Rfq) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("hargaPenawaran"));
    if (!Number.isFinite(amount) || amount < 0) {
      toast({
        title: "Harga tidak valid",
        description: "Masukkan harga per satuan berupa angka nol atau lebih.",
        variant: "destructive",
      });
      setBusy(false);
      return;
    }
    try {
      const offerResult = await request<{ data: VendorOffer }>(
        `/api/pengadaan/${rfq.pengadaan.id}/penawaran`,
        {
          method: "POST",
          body: JSON.stringify({
            rfqId: rfq.id,
            hargaPenawaran: amount,
            mataUang: String(form.get("mataUang") || "USD"),
            berlakuSampai: form.get("berlakuSampai") || undefined,
            catatan: form.get("catatan") || undefined,
          }),
        },
      );
      const selectedDocuments = (rfq.dokumenDiminta ?? []).flatMap(
        (requirement) => {
          const file = form.get(`dokumen-${requirement.id}`);
          return file instanceof File && file.size > 0
            ? [{ requirementId: requirement.id, file }]
            : [];
        },
      );
      await Promise.all(
        selectedDocuments.map(async ({ requirementId, file }) => {
          const upload = new FormData();
          upload.append("file", file);
          upload.append("requirementId", requirementId);
          upload.append("nama", file.name);
          await request(
            `/api/vendor-onboarding/me/offers/${offerResult.data.id}/documents`,
            { method: "POST", body: upload },
          );
        }),
      );
      const message = `Penawaran untuk ${rfq.nomor} berhasil dikirim.`;
      window.dispatchEvent(
        new CustomEvent("api:success", { detail: { message } }),
      );
      setQuoteModalRfqId(null);
      setQuoteAmount("");
      await refresh();
    } catch (e) {
      toast({
        title: "Penawaran gagal dikirim",
        description: e instanceof Error ? e.message : "Penawaran gagal dikirim",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={
          section === "profile"
            ? "Profil & Dokumen"
            : section === "rfq"
              ? "RFQ & Penawaran"
              : section === "negotiation"
                ? selectedNegotiationId
                  ? "Detail negosiasi"
                  : "Negosiasi"
                : selectedContractId
                  ? "Detail kontrak"
                  : "Kontrak"
        }
        description={
          section === "profile"
            ? "Kelola profil perusahaan dan dokumen legalitas."
            : section === "rfq"
              ? "Tinjau kebutuhan, ketentuan, dan tenggat sebelum mengirim penawaran."
              : section === "negotiation"
                ? selectedNegotiationId
                  ? "Tinjau asal RFQ, penawaran awal, dan berikan tanggapan atas permintaan negosiasi."
                  : "Tinjau daftar putaran negosiasi dari tim pengadaan."
                : selectedContractId
                  ? "Tinjau asal transaksi, dokumen, dan status kontrak."
                  : "Tinjau dan tandatangani kontrak yang dikirim kepada perusahaan Anda."
        }
      />
      {notice && (
        <div
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm"
        >
          {notice}
        </div>
      )}
      {loading ? (
        <LoadingState label="Memuat portal vendor…" />
      ) : !profile ? (
        <div className="rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground shadow-sm">
          Portal belum dapat dimuat. Periksa koneksi dan status akun, lalu coba
          muat ulang halaman.
        </div>
      ) : (
        <>
          {section === "profile" && (
            <>
              <article
                id="beranda"
                className="scroll-mt-6 rounded-xl border border-border/70 bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {profile.vendor.nama}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Status verifikasi:{" "}
                      <strong className="capitalize text-foreground">
                        {profile.status.replaceAll("_", " ")}
                      </strong>
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      profile.status === "approved"
                        ? "ok"
                        : profile.status === "requires_revision" ||
                            profile.status === "rejected"
                          ? "danger"
                          : "warn"
                    }
                  >
                    {profile.status === "approved"
                      ? "Akses sourcing aktif"
                      : "Akses penawaran terkunci"}
                  </StatusBadge>
                </div>
                {profile.rejectionReason && (
                  <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    Catatan reviewer: {profile.rejectionReason}
                  </p>
                )}
                <div className="mt-5 grid gap-4 border-t border-border/70 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <div>
                    <h3 className="text-sm font-semibold">Profil perusahaan</h3>
                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Email</dt>
                        <dd className="break-words">
                          {profile.vendor.email || "Belum diisi"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Telepon
                        </dt>
                        <dd>{profile.vendor.telepon || "Belum diisi"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">NPWP</dt>
                        <dd>{profile.vendor.npwp || "Belum diisi"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">
                          Kontak
                        </dt>
                        <dd>{profile.vendor.contactPerson || "Belum diisi"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">
                          Alamat
                        </dt>
                        <dd>{profile.vendor.alamat || "Belum diisi"}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">
                      Dokumen perusahaan
                    </h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {profile.vendor.vendorDocuments.length ? (
                        profile.vendor.vendorDocuments.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm"
                          >
                            <span className="min-w-0 truncate">
                              {doc.jenis}
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <StatusBadge
                                status={
                                  doc.status === "approved"
                                    ? "ok"
                                    : doc.status === "rejected"
                                      ? "danger"
                                      : "warn"
                                }
                              >
                                {doc.status}
                              </StatusBadge>
                              <button
                                type="button"
                                onClick={() => void download(doc.id)}
                                className="text-primary underline"
                              >
                                Lihat
                              </button>
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-muted-foreground">
                          Belum ada dokumen diunggah.
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="mt-5 border-t border-border/70 pt-5">
                  <h3 className="text-center text-sm font-semibold">
                    Proses verifikasi
                  </h3>
                  <ol className="mx-auto mt-5 grid max-w-5xl grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:gap-x-6">
                    {[
                      { title: "Profil perusahaan", done: true },
                      {
                        title: "Dokumen legalitas",
                        done: profile.vendor.vendorDocuments.length > 0,
                      },
                      {
                        title: "Review LEMIGAS",
                        done: [
                          "submitted",
                          "approved",
                          "requires_revision",
                          "rejected",
                        ].includes(profile.status),
                        active: profile.status === "submitted",
                      },
                      {
                        title: "Verifikasi selesai",
                        done: profile.status === "approved",
                      },
                    ].map((step, index) => (
                      <li
                        key={step.title}
                        className="relative flex flex-col items-center gap-2 text-center"
                      >
                        {index < 3 && (
                          <span
                            aria-hidden="true"
                            className="absolute left-[calc(50%+15px)] right-[calc(-50%+15px)] top-3.5 hidden h-px bg-border sm:block"
                          />
                        )}
                        <span
                          className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${step.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                        >
                          {step.done ? "✓" : index + 1}
                        </span>
                        <span
                          className={`max-w-full text-sm leading-snug ${step.active ? "font-semibold text-primary" : step.done ? "font-medium" : "text-muted-foreground"}`}
                        >
                          {step.title}
                          {step.active ? " · Sedang diproses" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
              <details
                id="profil-perusahaan"
                className="scroll-mt-6 rounded-xl border border-border/70 bg-card shadow-sm"
              >
                <summary className="cursor-pointer px-5 py-4 text-lg font-semibold">
                  Profil perusahaan{" "}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    Ubah data perusahaan
                  </span>
                </summary>
                <form
                  onSubmit={saveProfile}
                  className="space-y-4 border-t px-5 py-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      Email perusahaan
                      <input
                        name="email"
                        type="email"
                        defaultValue={profile.vendor.email ?? ""}
                        className="w-full rounded-md border bg-background p-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      Telepon
                      <input
                        name="telepon"
                        defaultValue={profile.vendor.telepon ?? ""}
                        className="w-full rounded-md border bg-background p-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      NPWP
                      <input
                        name="npwp"
                        defaultValue={profile.vendor.npwp ?? ""}
                        className="w-full rounded-md border bg-background p-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      Nama kontak
                      <input
                        name="contactPerson"
                        defaultValue={profile.vendor.contactPerson ?? ""}
                        className="w-full rounded-md border bg-background p-2"
                      />
                    </label>
                    <label className="space-y-1 text-sm sm:col-span-2">
                      Alamat
                      <textarea
                        name="alamat"
                        defaultValue={profile.vendor.alamat ?? ""}
                        rows={2}
                        className="w-full rounded-md border bg-background p-2"
                      />
                    </label>
                  </div>
                  <Button type="submit" disabled={busy}>
                    Simpan profil
                  </Button>
                </form>
              </details>
              <section
                id="profil-dokumen"
                className="scroll-mt-6 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm"
              >
                <div className="border-b border-border/70 px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Langkah 2 dari 2
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        Dokumen legalitas
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Unggah file langsung pada bagian jenis dokumen yang
                        sesuai. Format PDF, JPG, atau PNG; maksimal 10 MB.
                      </p>
                    </div>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {profile.vendor.vendorDocuments.length} dokumen diunggah
                    </span>
                  </div>
                </div>
                <div className="space-y-6 p-5 sm:p-6">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Daftar dan unggah dokumen
                    </h3>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {DOCUMENT_TYPES.map(({ value, label }) => {
                        const docs = profile.vendor.vendorDocuments.filter(
                          (doc) => doc.jenis === value,
                        );
                        return (
                          <li
                            key={value}
                            className="space-y-3 rounded-lg border border-border/70 bg-background p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 text-sm">
                                <p className="font-semibold">{label}</p>
                                {docs.length ? (
                                  docs.map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                    >
                                      <StatusBadge
                                        status={
                                          doc.status === "approved"
                                            ? "ok"
                                            : doc.status === "rejected"
                                              ? "danger"
                                              : "warn"
                                        }
                                      >
                                        {doc.status}
                                      </StatusBadge>
                                      <button
                                        type="button"
                                        onClick={() => void download(doc.id)}
                                        className="text-primary underline"
                                      >
                                        Lihat file
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Belum diunggah
                                  </p>
                                )}
                              </div>
                              <span
                                aria-hidden="true"
                                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${docs.length ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                              >
                                {docs.length ? "✓" : "·"}
                              </span>
                            </div>
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                void uploadDocument(value);
                              }}
                              className="space-y-2 border-t border-border/60 pt-3"
                            >
                              <UploadDocumentField
                                id={`vendor-document-${value}`}
                                required={false}
                                onFileChange={(selected) =>
                                  setFilesByType((current) => ({
                                    ...current,
                                    [value]: selected,
                                  }))
                                }
                                disabled={busy}
                              />
                              <Button
                                type="submit"
                                variant="outline"
                                disabled={busy || !filesByType[value]}
                                className="w-full"
                              >
                                <FileUp size={16} /> Unggah {label}
                              </Button>
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {profile.vendor.vendorDocuments.some(
                    (doc) =>
                      !DOCUMENT_TYPE_VALUES.includes(
                        doc.jenis as (typeof DOCUMENT_TYPE_VALUES)[number],
                      ),
                  ) && (
                    <div className="rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 text-sm">
                      <p className="font-medium">
                        Dokumen lama perlu dipetakan
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Dokumen lama tetap tersimpan dan dapat dibuka. Unggah
                        penggantinya pada kategori resmi di atas.
                      </p>
                      {profile.vendor.vendorDocuments
                        .filter(
                          (doc) =>
                            !DOCUMENT_TYPE_VALUES.includes(
                              doc.jenis as (typeof DOCUMENT_TYPE_VALUES)[number],
                            ),
                        )
                        .map((doc) => (
                          <div
                            key={doc.id}
                            className="mt-2 flex justify-between gap-2 text-muted-foreground"
                          >
                            <span>
                              {doc.jenis} · {doc.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => void download(doc.id)}
                              className="text-primary underline"
                            >
                              Lihat file
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <Button
                      type="button"
                      disabled={
                        busy || profile.vendor.vendorDocuments.length === 0
                      }
                      onClick={() => void submitOnboarding()}
                    >
                      <Send size={16} /> Ajukan verifikasi
                    </Button>
                  </div>
                </div>
              </section>
            </>
          )}
          {section === "rfq" && profile.status !== "approved" && (
            <section
              id="rfq-penawaran"
              className="scroll-mt-6 rounded-xl border border-border/70 bg-card p-5 shadow-sm"
            >
              <p className="text-sm text-muted-foreground">
                Fitur ini terbuka setelah verifikasi perusahaan disetujui.
                Setelah aktif, RFQ yang ditujukan kepada perusahaan Anda akan
                tampil di sini.
              </p>
            </section>
          )}
          {section === "negotiation" && profile.status === "approved" && (
            <NegotiationWorkspace
              negotiations={negotiations}
              rfqs={rfqs}
              selectedId={selectedNegotiationId}
              onSelect={(id) => openNegotiation(id)}
              onBack={() => openNegotiation()}
              busy={busy}
              onRespond={respondNegotiation}
              formatAmount={formatAmount}
            />
          )}
          {section === "contracts" && profile.status === "approved" && (
            <VendorContracts
              selectedContractId={selectedContractId}
              onOpenContract={openContract}
            />
          )}
          {section === "contracts" && profile.status !== "approved" && (
            <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
              Kontrak tersedia setelah verifikasi vendor disetujui.
            </p>
          )}
          {section === "rfq" && profile.status === "approved" && (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <article className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FileText size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      RFQ aktif / pernah diajukan
                    </p>
                    <p className="font-semibold">{rfqs.length} RFQ</p>
                  </div>
                </article>
                <article className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Clock3 size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Tenggat terdekat
                    </p>
                    <p className="font-semibold">
                      {rfqs.some((item) => item.batasRespons)
                        ? new Date(
                            Math.min(
                              ...rfqs
                                .filter((item) => item.batasRespons)
                                .map((item) =>
                                  new Date(item.batasRespons!).getTime(),
                                ),
                            ),
                          ).toLocaleDateString("id-ID")
                        : "Tidak ditentukan"}
                    </p>
                  </div>
                </article>
                <article className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700">
                    <CircleCheck size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Langkah berikutnya
                    </p>
                    <p className="font-semibold">Tinjau dan kirim</p>
                  </div>
                </article>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                <strong>Alur penawaran</strong>
                <ol className="mt-2 grid gap-2 sm:grid-cols-3">
                  <li>1. Periksa kebutuhan dan tenggat RFQ.</li>
                  <li>2. Isi harga, masa berlaku, dan catatan.</li>
                  <li>3. Lampirkan dokumen wajib, lalu kirim penawaran.</li>
                </ol>
              </div>
              {rfqs.length === 0 ? (
                <EmptyData
                  className="min-h-48 border-border/70 bg-card/70 shadow-sm"
                  label="Belum ada RFQ aktif untuk vendor ini."
                />
              ) : selectedRfqId ? (
                (() => {
                  const rfq = rfqs.find((item) => item.id === selectedRfqId);
                  if (!rfq)
                    return (
                      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                        <p>RFQ tidak ditemukan atau sudah tidak aktif.</p>
                        <Button
                          type="button"
                          variant="outline"
                          className="mt-3"
                          onClick={() => openRfq()}
                        >
                          Kembali ke daftar RFQ
                        </Button>
                      </div>
                    );
                  const expired = Boolean(
                    rfq.batasRespons &&
                    new Date(rfq.batasRespons).getTime() < Date.now(),
                  );
                  const priorOffers = rfq.penawaran ?? [];
                  const priorOffer = priorOffers[0];
                  const priorDetail = priorOffer?.detail ?? {};
                  const vendorNegotiation = negotiations.find(
                    (item) =>
                      item.penawaran.pengadaan.id === rfq.pengadaan.id &&
                      item.penawaran.nomorRfq === rfq.nomor,
                  );
                  const negotiationStarted = Boolean(vendorNegotiation);
                  const vendorProgress = !priorOffer
                    ? expired
                      ? "Masa RFQ berakhir · penawaran tidak dikirim"
                      : "Belum mengajukan penawaran"
                    : negotiationStarted
                      ? "Penawaran Anda masuk tahap klarifikasi / negosiasi"
                      : ((
                          {
                            aktif:
                              "Penawaran terkirim · menunggu tindak lanjut",
                            submitted:
                              "Penawaran terkirim · menunggu tindak lanjut",
                            approved: "Penawaran disetujui",
                            rejected: "Penawaran ditolak",
                            requires_revision: "Revisi diminta",
                            draft: "Draf penawaran",
                          } as Record<string, string>
                        )[priorOffer.status] ??
                        `Penawaran terkirim · ${priorOffer.status.replaceAll("_", " ")}`);
                  const dateInputValue = priorOffer?.berlakuSampai
                    ? new Date(priorOffer.berlakuSampai)
                        .toISOString()
                        .slice(0, 10)
                    : "";
                  const canonicalTerms: Array<[string, unknown]> = [
                    ["volume", rfq.volume],
                    ["satuan", rfq.satuan],
                    ["titikSerah", rfq.titikSerah],
                    ["syaratPenyerahan", rfq.syaratPenyerahan],
                    ["syaratPembayaran", rfq.syaratPembayaran],
                    ["spesifikasi", rfq.spesifikasi],
                    ["dokumenDiminta", rfq.dokumenDiminta],
                  ];
                  const terms = canonicalTerms.some(
                    ([, value]) =>
                      value !== null && value !== undefined && value !== "",
                  )
                    ? canonicalTerms.filter(
                        ([, value]) =>
                          value !== null &&
                          value !== undefined &&
                          value !== "" &&
                          !(Array.isArray(value) && value.length === 0),
                      )
                    : Object.entries(rfq.ketentuan ?? {})
                        .map(
                          ([key, value]) =>
                            [key, normalizedRfqTerm(key, value)] as const,
                        )
                        .filter(
                          ([, value]) =>
                            value !== null &&
                            value !== undefined &&
                            value !== "" &&
                            !(Array.isArray(value) && value.length === 0),
                        );
                  const documentRequirements = Array.isArray(rfq.dokumenDiminta)
                    ? rfq.dokumenDiminta
                    : [];
                  return (
                    <div key={rfq.id} className="space-y-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openRfq()}
                      >
                        ← Kembali ke daftar RFQ
                      </Button>
                      <article className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                        <header className="border-b bg-muted/20 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                {rfq.pengadaan.nomorSurat} · RFQ {rfq.nomor} ·
                                Revisi {rfq.revisi ?? 1}
                              </p>
                              <h2 className="mt-1 text-lg font-semibold">
                                {rfq.pengadaan.judul}
                              </h2>
                            </div>
                            <StatusBadge status={expired ? "danger" : "warn"}>
                              {expired ? "Tenggat lewat" : "Menunggu penawaran"}
                            </StatusBadge>
                          </div>
                          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock3 size={15} /> Batas respons:{" "}
                            {rfq.batasRespons
                              ? new Date(rfq.batasRespons).toLocaleString(
                                  "id-ID",
                                )
                              : "Tidak ditentukan"}
                          </p>
                          {rfq.alasanPerubahan && (
                            <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                              Perubahan: {rfq.alasanPerubahan}
                            </p>
                          )}
                          <div className="mt-4 rounded-lg border bg-background p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              Progres penawaran Anda
                            </p>
                            <p className="mt-1 text-sm font-semibold">
                              {vendorProgress}
                            </p>
                            {priorOffer?.submittedAt && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Dikirim{" "}
                                {new Date(
                                  priorOffer.submittedAt,
                                ).toLocaleString("id-ID")}
                              </p>
                            )}
                          </div>
                        </header>
                        <div className="space-y-5 p-5">
                          <section className="space-y-3">
                            <h3 className="flex items-center gap-2 font-semibold">
                              <FileText size={17} /> Ketentuan dan kebutuhan
                            </h3>
                            {terms.length ? (
                              <div className="space-y-3">
                                <dl className="divide-y rounded-lg border bg-background px-3">
                                  {terms
                                    .filter(
                                      ([, value]) => !structuredRows(value),
                                    )
                                    .map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="grid gap-1 py-2.5 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] sm:gap-4"
                                      >
                                        <dt className="text-xs font-medium text-muted-foreground">
                                          {rfqTermLabel(key)}
                                        </dt>
                                        <dd className="break-words whitespace-pre-wrap text-sm leading-5">
                                          {formatRfqValue(value)}
                                        </dd>
                                      </div>
                                    ))}
                                </dl>
                                {terms
                                  .filter(
                                    ([key, value]) =>
                                      key !== "dokumenDiminta" &&
                                      structuredRows(value),
                                  )
                                  .map(([key, value]) => {
                                    const rows = structuredRows(value) ?? [];
                                    return (
                                      <section
                                        key={key}
                                        className="overflow-hidden rounded-lg border bg-background"
                                      >
                                        <h4 className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                                          {rfqTermLabel(key)}
                                        </h4>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="h-9 px-3 text-[11px]">
                                                Item
                                              </TableHead>
                                              <TableHead className="h-9 px-3 text-[11px]">
                                                Keterangan
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {rows.map(([name, item], index) => (
                                              <TableRow
                                                key={`${name}-${index}`}
                                              >
                                                <TableCell className="w-[35%] break-words px-3 py-2 text-xs font-medium">
                                                  {name}
                                                </TableCell>
                                                <TableCell className="break-words whitespace-pre-wrap px-3 py-2 text-xs leading-5">
                                                  {formatRfqValue(item)}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </section>
                                    );
                                  })}
                                {documentRequirements.length > 0 && (
                                  <section className="overflow-hidden rounded-lg border bg-background">
                                    <h4 className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                                      Dokumen diminta
                                    </h4>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="h-9 px-3 text-[11px]">
                                            Dokumen
                                          </TableHead>
                                          <TableHead className="h-9 px-3 text-[11px]">
                                            Status
                                          </TableHead>
                                          <TableHead className="h-9 px-3 text-[11px]">
                                            Keterangan
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {documentRequirements.map(
                                          (requirement) => (
                                            <TableRow key={requirement.id}>
                                              <TableCell className="px-3 py-2 text-xs font-medium">
                                                {requirement.nama}
                                              </TableCell>
                                              <TableCell className="px-3 py-2 text-xs">
                                                {requirement.wajib
                                                  ? "Wajib"
                                                  : "Opsional"}
                                              </TableCell>
                                              <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                                                {requirement.keterangan || "—"}
                                              </TableCell>
                                            </TableRow>
                                          ),
                                        )}
                                      </TableBody>
                                    </Table>
                                  </section>
                                )}
                              </div>
                            ) : (
                              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                                Ketentuan belum disertakan pada RFQ.
                              </p>
                            )}
                          </section>
                          <section className="flex flex-col gap-4 rounded-xl border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h3 className="font-semibold">
                                {negotiationStarted
                                  ? "Tahap penawaran"
                                  : priorOffer
                                    ? "Revisi penawaran"
                                    : "Kirim penawaran"}
                              </h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {negotiationStarted
                                  ? "Perubahan penawaran ditutup karena proses sudah masuk klarifikasi / negosiasi. Pantau tanggapan dan progres pada menu Negosiasi."
                                  : expired
                                    ? "Masa RFQ berakhir. Penawaran tidak dapat dibuat atau diubah."
                                    : priorOffer
                                      ? `Penawaran terakhir diperbarui ${priorOffer.updatedAt ? new Date(priorOffer.updatedAt).toLocaleString("id-ID") : ""}. Revisi akan mengganti penawaran aktif sebelumnya.`
                                      : `Belum ada penawaran untuk RFQ ${rfq.nomor}, revisi ${rfq.revisi ?? 1}.`}
                              </p>
                            </div>
                            {priorOffers.length > 0 && (
                              <div className="space-y-2 rounded-lg border bg-background p-3">
                                <p className="text-sm font-medium">
                                  Daftar penawaran Anda ({priorOffers.length})
                                </p>
                                {priorOffers.map((offer, index) => (
                                  <div
                                    key={offer.id}
                                    className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm"
                                  >
                                    <span>
                                      {index === 0
                                        ? "Terbaru"
                                        : `Penawaran ${index + 1}`}{" "}
                                      · {offer.nomorRfq ?? rfq.nomor}
                                    </span>
                                    <span className="font-medium">
                                      {offer.mataUang}{" "}
                                      {Number(
                                        offer.hargaPenawaran ?? 0,
                                      ).toLocaleString("id-ID", {
                                        maximumFractionDigits: 4,
                                      })}{" "}
                                      / {rfq.satuan || "satuan"} ·{" "}
                                      {offer.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {expired ? (
                              <p className="text-sm text-destructive">
                                Tenggat lewat. Pengiriman tidak tersedia.
                              </p>
                            ) : negotiationStarted ? (
                              <p className="text-sm font-medium text-muted-foreground">
                                Penawaran terkunci · proses negosiasi berjalan
                              </p>
                            ) : (
                              <Button
                                type="button"
                                className="w-full sm:w-auto"
                                onClick={() => setQuoteModalRfqId(rfq.id)}
                              >
                                <Send size={16} />{" "}
                                {priorOffer
                                  ? "Ubah penawaran"
                                  : "Buat penawaran"}
                              </Button>
                            )}
                          </section>
                        </div>
                        <Modal
                          open={quoteModalRfqId === rfq.id}
                          onClose={() => setQuoteModalRfqId(null)}
                          title={
                            priorOffer
                              ? "Kirim revisi penawaran"
                              : "Kirim penawaran"
                          }
                          description={`RFQ ${rfq.nomor} · Revisi ${rfq.revisi ?? 1}`}
                          size="md"
                          contentClassName="!h-[90dvh]"
                          bodyClassName="min-h-0 space-y-5 overflow-y-auto"
                          footer={
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setQuoteModalRfqId(null)}
                              >
                                Batal
                              </Button>
                              <Button
                                type="submit"
                                form={`quote-form-${rfq.id}`}
                                disabled={busy}
                              >
                                <Send size={16} />{" "}
                                {busy
                                  ? "Mengirim…"
                                  : priorOffer
                                    ? "Kirim revisi"
                                    : "Kirim penawaran"}
                              </Button>
                            </>
                          }
                        >
                          <form
                            id={`quote-form-${rfq.id}`}
                            key={priorOffer?.id ?? rfq.id}
                            onSubmit={(e) => void submitQuote(e, rfq)}
                            className="space-y-5"
                          >
                            <section className="overflow-hidden rounded-xl border bg-muted/20">
                              <div className="border-b bg-background px-4 py-3">
                                <h3 className="font-semibold">Ketentuan RFQ</h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Baseline kebutuhan LEMIGAS. Nilai ini tidak
                                  dapat diubah dalam penawaran.
                                </p>
                              </div>
                              <div className="space-y-3 p-4">
                                <dl className="divide-y rounded-lg border bg-background px-3">
                                  {terms
                                    .filter(
                                      ([, value]) => !structuredRows(value),
                                    )
                                    .map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="grid gap-1 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4"
                                      >
                                        <dt className="text-xs font-medium text-muted-foreground">
                                          {rfqTermLabel(key)}
                                        </dt>
                                        <dd className="break-words whitespace-pre-wrap text-sm leading-5">
                                          {formatRfqValue(value)}
                                        </dd>
                                      </div>
                                    ))}
                                </dl>
                                {terms
                                  .filter(
                                    ([key, value]) =>
                                      key !== "dokumenDiminta" &&
                                      structuredRows(value),
                                  )
                                  .map(([key, value]) => {
                                    const rows = structuredRows(value) ?? [];
                                    return (
                                      <section
                                        key={key}
                                        className="overflow-hidden rounded-lg border bg-background"
                                      >
                                        <h4 className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                                          {rfqTermLabel(key)}
                                        </h4>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="h-9 px-3 text-[11px]">
                                                Item
                                              </TableHead>
                                              <TableHead className="h-9 px-3 text-[11px]">
                                                Keterangan
                                              </TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {rows.map(([name, item], index) => (
                                              <TableRow
                                                key={`${name}-${index}`}
                                              >
                                                <TableCell className="w-[35%] break-words px-3 py-2 text-xs font-medium">
                                                  {name}
                                                </TableCell>
                                                <TableCell className="break-words whitespace-pre-wrap px-3 py-2 text-xs leading-5">
                                                  {formatRfqValue(item)}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </section>
                                    );
                                  })}
                                {documentRequirements.length > 0 && (
                                  <section className="overflow-hidden rounded-lg border bg-background">
                                    <h4 className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide">
                                      Dokumen diminta
                                    </h4>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="h-9 px-3 text-[11px]">
                                            Dokumen
                                          </TableHead>
                                          <TableHead className="h-9 px-3 text-[11px]">
                                            Status
                                          </TableHead>
                                          <TableHead className="h-9 px-3 text-[11px]">
                                            Keterangan
                                          </TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {documentRequirements.map(
                                          (requirement) => (
                                            <TableRow key={requirement.id}>
                                              <TableCell className="px-3 py-2 text-xs font-medium">
                                                {requirement.nama}
                                              </TableCell>
                                              <TableCell className="px-3 py-2 text-xs">
                                                {requirement.wajib
                                                  ? "Wajib"
                                                  : "Opsional"}
                                              </TableCell>
                                              <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                                                {requirement.keterangan || "—"}
                                              </TableCell>
                                            </TableRow>
                                          ),
                                        )}
                                      </TableBody>
                                    </Table>
                                  </section>
                                )}
                              </div>
                            </section>
                            <section className="space-y-3 rounded-xl border bg-background p-4">
                              <div>
                                <h3 className="font-semibold">
                                  Harga penawaran per satuan
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Masukkan harga untuk satu{" "}
                                  {rfq.satuan || "satuan"}, bukan total seluruh
                                  volume.
                                </p>
                              </div>
                              <div className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-950">
                                Volume acuan RFQ:{" "}
                                <strong>
                                  {rfq.volume == null
                                    ? "—"
                                    : Number(rfq.volume).toLocaleString(
                                        "id-ID",
                                        { maximumFractionDigits: 4 },
                                      )}{" "}
                                  {rfq.satuan || ""}
                                </strong>
                              </div>
                              <label className="block space-y-1 text-sm">
                                Harga per {rfq.satuan || "satuan"} *
                                <span className="flex overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/40">
                                  <span className="flex min-w-14 items-center justify-center border-r bg-muted/40 px-3 text-sm font-medium text-muted-foreground">
                                    {currencyConfig[quoteCurrency]?.prefix ??
                                      quoteCurrency}
                                  </span>
                                  <input
                                    name="hargaPenawaran"
                                    type="number"
                                    required
                                    min="0"
                                    step="0.0001"
                                    inputMode="decimal"
                                    value={quoteAmount}
                                    onChange={(event) =>
                                      setQuoteAmount(event.target.value)
                                    }
                                    placeholder="Contoh: 92.50"
                                    className="w-full min-w-0 bg-transparent px-3 py-2 text-sm outline-none"
                                  />
                                  <span className="flex items-center border-l bg-muted/40 px-3 text-sm text-muted-foreground">
                                    / {rfq.satuan || "satuan"}
                                  </span>
                                </span>
                              </label>
                              {quoteAmount !== "" &&
                              Number.isFinite(Number(quoteAmount)) &&
                              rfq.volume != null &&
                              Number.isFinite(Number(rfq.volume)) ? (
                                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                                  Perkiraan subtotal barang:{" "}
                                  <strong>
                                    {quoteCurrency}{" "}
                                    {formatAmount(
                                      Number(quoteAmount) * Number(rfq.volume),
                                      quoteCurrency,
                                    )}
                                  </strong>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    Harga per satuan × volume RFQ. Belum
                                    termasuk freight, asuransi, pajak/bea,
                                    inspeksi, atau biaya lain.
                                  </p>
                                </div>
                              ) : null}
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1 text-sm">
                                  <span className="block">Mata uang</span>
                                  <FilterCombobox
                                    id={`quote-currency-${rfq.id}`}
                                    name="mataUang"
                                    label="mata uang"
                                    searchPlaceholder="Cari kode atau nama mata uang..."
                                    options={[
                                      { value: "IDR", label: "IDR - Rupiah (Rp)" },
                                      { value: "USD", label: "USD - Dolar AS ($)" },
                                      { value: "RUB", label: "RUB - Rubel Rusia (RUB)" },
                                    ]}
                                    value={quoteCurrency}
                                    onValueChange={setQuoteCurrency}
                                  />
                                </div>
                                <label className="space-y-1 text-sm">
                                  Berlaku sampai
                                  <input
                                    name="berlakuSampai"
                                    type="date"
                                    defaultValue={dateInputValue}
                                    className="w-full rounded-md border bg-background p-2"
                                  />
                                </label>
                              </div>
                              <label className="block space-y-1 text-sm">
                                Catatan vendor
                                <textarea
                                  name="catatan"
                                  rows={3}
                                  defaultValue={String(
                                    priorDetail.catatan ?? "",
                                  )}
                                  className="w-full rounded-md border bg-background p-2"
                                  placeholder="Klarifikasi atau catatan untuk tim pengadaan"
                                />
                              </label>
                            </section>
                            {documentRequirements.length > 0 && (
                              <section className="space-y-3 rounded-xl border bg-background p-4">
                                <div>
                                  <h3 className="font-semibold">
                                    Dokumen persyaratan
                                  </h3>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Unggah bukti sesuai persyaratan RFQ. File
                                    terhubung ke revisi penawaran ini.
                                  </p>
                                </div>
                                <div className="space-y-3">
                                  {documentRequirements.map((requirement) => {
                                    const existingDocument = (
                                      priorOffer?.dokumenPenawaran ?? []
                                    ).find(
                                      (document) =>
                                        document.requirementId ===
                                        requirement.id,
                                    );
                                    const required = Boolean(
                                      requirement.wajib && !existingDocument,
                                    );
                                    return (
                                      <div
                                        key={requirement.id}
                                        className="rounded-lg border bg-muted/20 p-3"
                                      >
                                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                          <div>
                                            <p className="text-sm font-medium">
                                              {requirement.nama}{" "}
                                              {requirement.wajib ? (
                                                <span className="text-destructive">
                                                  *
                                                </span>
                                              ) : (
                                                <span className="text-muted-foreground">
                                                  (Opsional)
                                                </span>
                                              )}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              {requirement.keterangan ||
                                                (requirement.wajib
                                                  ? "Wajib dilampirkan"
                                                  : "Lampirkan bila relevan")}
                                            </p>
                                          </div>
                                          {existingDocument ? (
                                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                                              Sudah terlampir
                                            </span>
                                          ) : null}
                                        </div>
                                        <UploadDocumentField
                                          id={`offer-document-${rfq.id}-${requirement.id}`}
                                          name={`dokumen-${requirement.id}`}
                                          required={required}
                                          disabled={busy}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            )}
                          </form>
                        </Modal>
                      </article>
                    </div>
                  );
                })()
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  <div className="border-b p-4">
                    <h2 className="font-semibold">Daftar RFQ</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Pilih RFQ untuk melihat ketentuan dan mengirim penawaran.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Proyek</th>
                          <th className="px-4 py-3">Nomor RFQ</th>
                          <th className="px-4 py-3">Revisi</th>
                          <th className="px-4 py-3">Batas respons</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">
                            <span className="sr-only">Aksi</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {rfqs.map((rfq) => {
                          const expired = Boolean(
                            rfq.batasRespons &&
                            new Date(rfq.batasRespons).getTime() < Date.now(),
                          );
                          const latestOffer = rfq.penawaran?.[0];
                          const offerStatus = latestOffer?.status;
                          const progressLabel = offerStatus
                            ? ((
                                {
                                  submitted:
                                    "Penawaran terkirim · menunggu review",
                                  approved: "Penawaran disetujui",
                                  rejected: "Penawaran ditolak",
                                  requires_revision: "Perlu revisi penawaran",
                                  draft: "Draf penawaran",
                                } as Record<string, string>
                              )[offerStatus] ??
                              `Penawaran · ${offerStatus.replaceAll("_", " ")}`)
                            : expired
                              ? "Tenggat lewat · belum mengajukan"
                              : "Belum mengajukan";
                          return (
                            <tr key={rfq.id} className="hover:bg-muted/20">
                              <td className="px-4 py-3">
                                <p className="font-medium">
                                  {rfq.pengadaan.judul}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {rfq.pengadaan.nomorSurat}
                                </p>
                              </td>
                              <td className="px-4 py-3 font-medium">
                                {rfq.nomor}
                              </td>
                              <td className="px-4 py-3">R{rfq.revisi ?? 1}</td>
                              <td className="px-4 py-3">
                                {rfq.batasRespons
                                  ? new Date(
                                      rfq.batasRespons,
                                    ).toLocaleDateString("id-ID")
                                  : "Tidak ditentukan"}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge
                                  status={
                                    offerStatus === "approved"
                                      ? "ok"
                                      : offerStatus === "rejected" ||
                                          (expired && !latestOffer)
                                        ? "danger"
                                        : latestOffer
                                          ? "warn"
                                          : "warn"
                                  }
                                >
                                  {progressLabel}
                                </StatusBadge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRfq(rfq.id)}
                                >
                                  Lihat detail
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
          {section === "negotiation" && profile.status !== "approved" && (
            <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Negosiasi terkunci</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Tanggapan negosiasi tersedia setelah onboarding disetujui dan
                tim pengadaan mengirim putaran negosiasi.
              </p>
            </section>
          )}
        </>
      )}
    </section>
  );
}

export default function VendorPortalPage() {
  return <VendorPortalView />;
}
