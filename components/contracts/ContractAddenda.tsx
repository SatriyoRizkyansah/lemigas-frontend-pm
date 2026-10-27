"use client";

import { useState, type FormEvent } from "react";
import { Download, FileCheck2, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UploadDocumentField } from "@/components/documents/DocumentControls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { ContentType } from "@/lib/api/generated/api-generated";

type Document = { id: string; jenis: string; originalName: string };
type Contract = {
  id: string;
  nomor: string;
  revision: number;
  mulaiBerlaku?: string | null;
  berakhirPada?: string | null;
  dokumen?: Document[];
  adendum?: Array<{ nomor: string; status: string }>;
};
export type Addendum = {
  id: string;
  nomor: string;
  alasan: string;
  status: string;
  revision: number;
  dikirimPada?: string | null;
  berlakuPada?: string | null;
  catatanRevisi?: string | null;
  perubahan?: {
    fields?: Record<string, { sebelum: unknown; sesudah: unknown }>;
  };
  dokumen?: Document[];
  kontrak?: {
    id: string;
    nomor: string;
    pengadaanId: string;
    vendor?: { nama?: string };
    pengadaan?: { judul?: string; nomorSurat?: string };
  };
};
const fields: Record<string, string> = {
  nilai: "Nilai total",
  mataUang: "Mata uang",
  volumeKontrak: "Volume",
  satuanKontrak: "Satuan",
  titikSerah: "Titik serah",
  ketentuanPembayaran: "Ketentuan pembayaran",
  formulaHarga: "Formula harga",
  pengalihanRisiko: "Pengalihan risiko",
  forceMajeure: "Force majeure",
  hukumBerlaku: "Hukum berlaku",
  berakhirPada: "Tanggal berakhir",
};
const labels: Record<string, string> = {
  draft: "Draft",
  menunggu_persetujuan: "Menunggu persetujuan",
  menunggu_tanda_tangan_vendor: "Menunggu tanda tangan vendor",
  finalisasi_lemigas: "Finalisasi LEMIGAS",
  efektif: "Efektif",
  dibatalkan: "Dibatalkan",
  diakhiri: "Diakhiri",
};
const addendumStages = [
  { status: "draft", label: "Draft" },
  { status: "menunggu_persetujuan", label: "Persetujuan" },
  { status: "menunggu_tanda_tangan_vendor", label: "Tanda tangan vendor" },
  { status: "finalisasi_lemigas", label: "Finalisasi LEMIGAS" },
  { status: "efektif", label: "Efektif" },
];
function unwrap<T>(value: unknown): T {
  let result: any = value;
  for (
    let i = 0;
    i < 4 && result && typeof result === "object" && "data" in result;
    i++
  )
    result = result.data;
  return result as T;
}
function display(value: unknown, key?: string) {
  if (value == null || value === "") return "—";
  if (key === "berakhirPada") return formatDate(String(value));
  return String(value);
}
function formatDate(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return `${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" }).format(new Date(value))} WIB`;
}
function localDate(value?: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  const d = new Date(new Date(value).getTime() + 7 * 3600000);
  return d.toISOString().slice(0, 16);
}
function isoDate(value: string) {
  return new Date(`${value}:00+07:00`).toISOString();
}
const baseUrl = (pengadaanId: string, contractId: string) =>
  `/api/pengadaan/${encodeURIComponent(pengadaanId)}/contracts/${encodeURIComponent(contractId)}/addenda`;
const download = (id: string) =>
  `/api/contract-documents/${encodeURIComponent(id)}/download`;
async function request(
  path: string,
  method: "POST" | "PUT",
  body: Record<string, unknown> | FormData,
) {
  setBrowserToken();
  return apiData(
    browserApi.request({
      path,
      method,
      secure: true,
      type: body instanceof FormData ? ContentType.FormData : ContentType.Json,
      format: "json",
      body,
    }),
  );
}
function changes(addendum: Addendum) {
  return Object.entries(addendum.perubahan?.fields ?? {});
}
function AddendumProgress({ status }: { status: string }) {
  const current = addendumStages.findIndex((stage) => stage.status === status);
  if (current < 0) return null;
  return (
    <ol
      aria-label="Progres adendum"
      className="grid min-w-[350px] grid-cols-5 gap-1"
    >
      {addendumStages.map((stage, index) => {
        const complete = index < current || status === "efektif";
        const selected = index === current;
        return (
          <li key={stage.status} className="min-w-0 text-center">
            <span
              className={`mx-auto grid size-6 place-items-center rounded-full border text-[10px] font-semibold ${complete ? "border-emerald-600 bg-emerald-600 text-white" : selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
            >
              {complete ? "✓" : index + 1}
            </span>
            <span
              className={`mt-1 block whitespace-normal text-[10px] leading-3 ${selected ? "font-semibold text-foreground" : "text-muted-foreground"}`}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
function Documents({ addendum }: { addendum: Addendum }) {
  const latest = new Map<string, Document>();
  for (const doc of addendum.dokumen ?? [])
    if (!latest.has(doc.jenis)) latest.set(doc.jenis, doc);
  const names: Record<string, string> = {
    draft: "Draft adendum",
    approved: "Versi disetujui",
    vendor_signed: "Tanda tangan vendor",
    final_signed: "Adendum final",
  };
  const all = Array.from(latest.values());
  const preferred: Record<string, string[]> = {
    draft: ["draft"],
    menunggu_persetujuan: ["draft"],
    menunggu_tanda_tangan_vendor: ["approved"],
    finalisasi_lemigas: ["vendor_signed", "approved"],
    efektif: ["final_signed", "vendor_signed"],
    dipenuhi: ["final_signed", "vendor_signed"],
  };
  const main = preferred[addendum.status]
    ? preferred[addendum.status].flatMap((kind) =>
        all.filter((doc) => doc.jenis === kind),
      )
    : all;
  const history = all.filter((doc) => !main.some((item) => item.id === doc.id));
  const renderRow = (doc: Document) => (
    <div
      key={doc.id}
      className="flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2.5"
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-md ${doc.jenis === "vendor_signed" || doc.jenis === "final_signed" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}
      >
        {doc.jenis === "vendor_signed" || doc.jenis === "final_signed" ? (
          <FileCheck2 size={16} />
        ) : (
          <FileText size={16} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-muted-foreground">
          {names[doc.jenis] ?? doc.jenis.replaceAll("_", " ")}
        </span>
        <span
          className="block truncate text-sm font-medium"
          title={doc.originalName}
        >
          {doc.originalName}
        </span>
      </span>
      <a
        href={download(doc.id)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Unduh ${names[doc.jenis] ?? doc.jenis} ${doc.originalName}`}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
      >
        <Download size={14} /> Unduh
      </a>
    </div>
  );
  return (
    <section className="space-y-2.5 rounded-lg border p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Dokumen adendum</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Berkas yang terkait dengan tahap saat ini.
          </p>
        </div>
        {main.length ? (
          <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {main.length} dokumen
          </span>
        ) : null}
      </div>
      {main.length ? (
        <div className="grid gap-2 sm:grid-cols-2">{main.map(renderRow)}</div>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          Belum ada dokumen pada tahap ini.
        </p>
      )}
      {history.length ? (
        <details className="group border-t pt-2">
          <summary className="cursor-pointer list-none text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            Riwayat dokumen ({history.length})
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {history.map(renderRow)}
          </div>
        </details>
      ) : null}
    </section>
  );
}
function Changes({ addendum }: { addendum: Addendum }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left text-muted-foreground">
          <tr>
            <th className="p-3">Bagian</th>
            <th className="p-3">Sebelumnya</th>
            <th className="p-3">Usulan</th>
          </tr>
        </thead>
        <tbody>
          {changes(addendum).map(([key, change]) => (
            <tr key={key} className="border-t align-top">
              <td className="p-3 font-medium">{fields[key] ?? key}</td>
              <td className="whitespace-pre-wrap p-3">
                {display(change.sebelum, key)}
              </td>
              <td className="whitespace-pre-wrap p-3">
                {display(change.sesudah, key)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Detail({ addendum }: { addendum: Addendum }) {
  return (
    <div className="space-y-4">
      <section className="space-y-2.5 rounded-lg border p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Tahapan adendum</h3>
          <StatusBadge
            status={
              addendum.status === "efektif"
                ? "ok"
                : addendum.status === "dibatalkan"
                  ? "neutral"
                  : "warn"
            }
          >
            {labels[addendum.status] ?? addendum.status}
          </StatusBadge>
        </div>
        {addendum.status === "dibatalkan" ? (
          <p className="text-sm text-muted-foreground">Adendum dibatalkan</p>
        ) : addendum.status === "diakhiri" ? (
          <p className="text-sm text-muted-foreground">Adendum diakhiri</p>
        ) : (
          <AddendumProgress status={addendum.status} />
        )}
      </section>
      <section className="rounded-lg border p-3 sm:p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Alasan perubahan
        </h3>
        <p className="mt-1.5 whitespace-pre-wrap text-sm">{addendum.alasan}</p>
        {addendum.catatanRevisi ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Catatan: {addendum.catatanRevisi}
          </p>
        ) : null}
        {addendum.berlakuPada ? (
          <p className="mt-3 text-sm">
            <span className="text-muted-foreground">Berlaku sejak: </span>
            {formatDate(addendum.berlakuPada)}
          </p>
        ) : null}
      </section>
      <section className="space-y-2.5">
        <div>
          <h3 className="text-sm font-semibold">Perubahan ketentuan</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Perbandingan nilai kontrak sebelum dan sesudah adendum.
          </p>
        </div>
        <Changes addendum={addendum} />
      </section>
      <Documents addendum={addendum} />
    </div>
  );
}

export function ContractValidityCorrection({
  contract,
  pengadaanId,
  canManage,
}: {
  contract: Contract;
  pengadaanId: string;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const mutation = use_mutation<unknown, Error, void>({
    tag: "contract",
    method: "correct-validity",
    invalidateKeys: [
      apiQueryKeys.resource("contract"),
      apiQueryKeys.resource("siklusTransaksiKomoditas"),
      apiQueryKeys.resource("auditLog"),
    ],
    mutationFn: () =>
      request(
        `/api/pengadaan/${encodeURIComponent(pengadaanId)}/contracts/${encodeURIComponent(contract.id)}/validity-correction`,
        "PUT",
        {
          expectedRevision: contract.revision,
          mulaiBerlaku: isoDate(start),
          berakhirPada: end ? isoDate(end) : null,
          alasan: reason.trim(),
          sesuaiDokumen: confirmed,
        },
      ),
    onSuccess: () => setOpen(false),
  });
  const final = contract.dokumen?.find((doc) => doc.jenis === "final_signed");
  const activeAddendum = contract.adendum?.find((item) =>
    [
      "draft",
      "menunggu_persetujuan",
      "menunggu_tanda_tangan_vendor",
      "finalisasi_lemigas",
    ].includes(item.status),
  );
  return (
    <div className="rounded-lg border bg-muted/10 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">Masa berlaku kontrak</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mulai: {formatDate(contract.mulaiBerlaku)} · Berakhir:{" "}
            {contract.berakhirPada
              ? formatDate(contract.berakhirPada)
              : "Tidak ditentukan"}
          </p>
        </div>
        {canManage ? (
          activeAddendum ? (
            <p className="max-w-sm text-right text-xs text-muted-foreground">
              Koreksi tanggal tersedia setelah adendum {activeAddendum.nomor}{" "}
              selesai atau dibatalkan.
            </p>
          ) : (
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => {
                setStart(localDate(contract.mulaiBerlaku));
                setEnd(localDate(contract.berakhirPada));
                setReason("");
                setConfirmed(false);
                mutation.reset();
                setOpen(true);
              }}
            >
              Koreksi tanggal
            </Button>
          )
        ) : null}
      </div>
      <Modal
        open={open}
        onClose={() => !mutation.isPending && setOpen(false)}
        title="Koreksi masa berlaku"
        description="Gunakan hanya untuk memperbaiki kesalahan pencatatan sesuai PDF kontrak final. Perubahan ketentuan kontrak dilakukan melalui adendum."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="contract-validity-form"
              disabled={
                mutation.isPending || !start || !reason.trim() || !confirmed
              }
            >
              Simpan koreksi
            </Button>
          </>
        }
      >
        <form
          id="contract-validity-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {final ? (
            <a
              className="text-sm text-primary underline"
              href={download(final.id)}
              target="_blank"
              rel="noreferrer"
            >
              Buka PDF kontrak final: {final.originalName}
            </a>
          ) : (
            <p className="text-sm text-destructive">
              PDF final tidak tersedia.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Mulai berlaku (WIB)</Label>
              <Input
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Berakhir (WIB, opsional)</Label>
              <Input
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Alasan koreksi</Label>
            <textarea
              className="min-h-20 w-full rounded-md border bg-background p-2 text-sm"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Saya telah mencocokkan tanggal dengan PDF kontrak final.
          </label>
          {mutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}

type Mode =
  "detail" | "edit" | "draft" | "submit" | "send" | "finalize" | "cancel";
export function ContractAddenda({
  pengadaanId,
  contract,
  canManage,
}: {
  pengadaanId: string;
  contract: Contract;
  canManage: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nomor, setNomor] = useState("");
  const [alasan, setAlasan] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [signer, setSigner] = useState({
    nama: "",
    jabatan: "",
    email: "",
    tanggal: "",
    berlaku: "",
  });
  const list = use_query<Addendum[], Error, string>({
    tag: "contract",
    method: "addenda",
    params: contract.id,
    queryFn: async () => {
      setBrowserToken();
      return unwrap<Addendum[]>(
        await apiData(
          browserApi.request({
            path: baseUrl(pengadaanId, contract.id),
            method: "GET",
            secure: true,
            format: "json",
          }),
        ),
      );
    },
  });
  const selected = list.data?.find((item) => item.id === selectedId);
  const mutation = use_mutation<unknown, Error, void>({
    tag: "contract",
    method: "addendum-action",
    invalidateKeys: [
      apiQueryKeys.resource("contract"),
      apiQueryKeys.resource("siklusTransaksiKomoditas"),
      apiQueryKeys.resource("notifikasi"),
      apiQueryKeys.resource("auditLog"),
    ],
    mutationFn: async () => {
      const base = baseUrl(pengadaanId, contract.id);
      const item = selected
        ? `${base}/${encodeURIComponent(selected.id)}`
        : base;
      if (mode === "edit") {
        const perubahan: Record<string, unknown> = {};
        for (const key of selectedFields) {
          const value = values[key] ?? "";
          if (key === "berakhirPada")
            perubahan[key] = value ? isoDate(value) : null;
          else if (key === "nilai" || key === "volumeKontrak") {
            if (!value.trim() || !Number.isFinite(Number(value)))
              throw new Error(`${fields[key]} harus berupa angka.`);
            perubahan[key] = Number(value);
          } else perubahan[key] = value;
        }
        return request(item, selected ? "PUT" : "POST", {
          nomor,
          alasan,
          perubahan,
          ...(selected ? { expectedRevision: selected.revision } : {}),
        });
      }
      if (!selected) throw new Error("Adendum tidak ditemukan.");
      if (mode === "submit" || mode === "send" || mode === "cancel")
        return request(`${item}/${mode}`, "POST", {
          expectedRevision: selected.revision,
          ...(mode === "cancel" ? { alasan } : {}),
        });
      if (!file) throw new Error("Pilih PDF terlebih dahulu.");
      const body = new FormData();
      body.append("file", file);
      body.append("expectedRevision", String(selected.revision));
      if (mode === "finalize") {
        body.append("penandatanganNama", signer.nama);
        body.append("penandatanganJabatan", signer.jabatan);
        if (signer.email) body.append("penandatanganEmail", signer.email);
        body.append("tanggalTandaTangan", isoDate(signer.tanggal));
        body.append("berlakuPada", isoDate(signer.berlaku));
      }
      return request(
        `${item}/${mode === "draft" ? "draft-document" : "finalize"}`,
        "POST",
        body,
      );
    },
    onSuccess: () => {
      setMode(null);
      void list.refetch();
    },
  });
  function open(next: Mode, item?: Addendum) {
    mutation.reset();
    setSelectedId(item?.id ?? null);
    setNomor(item?.nomor ?? "");
    setAlasan(next === "cancel" ? "" : (item?.alasan ?? ""));
    const entries = item ? changes(item) : [];
    setSelectedFields(entries.map(([key]) => key));
    setValues(
      Object.fromEntries(
        entries.map(([key, value]) => [
          key,
          key === "berakhirPada"
            ? localDate(String(value.sesudah ?? ""))
            : String(value.sesudah ?? ""),
        ]),
      ),
    );
    setFile(null);
    setSigner({ nama: "", jabatan: "", email: "", tanggal: "", berlaku: "" });
    setMode(next);
  }
  const titles: Record<Mode, string> = {
    detail: "Detail adendum",
    edit: selected ? "Ubah draft adendum" : "Buat draft adendum",
    draft: "Unggah PDF draft adendum",
    submit: "Ajukan persetujuan adendum",
    send: "Kirim adendum ke vendor",
    finalize: "Finalisasi adendum",
    cancel: "Batalkan adendum",
  };
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Adendum kontrak</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Opsional. Perubahan berlaku setelah disetujui dan ditandatangani
            kedua pihak.
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            disabled={
              list.isPending ||
              list.isError ||
              list.data?.some((item) =>
                [
                  "draft",
                  "menunggu_persetujuan",
                  "menunggu_tanda_tangan_vendor",
                  "finalisasi_lemigas",
                ].includes(item.status),
              )
            }
            onClick={() => open("edit")}
          >
            Buat adendum
          </Button>
        ) : null}
      </div>
      {list.data?.some((item) =>
        [
          "draft",
          "menunggu_persetujuan",
          "menunggu_tanda_tangan_vendor",
          "finalisasi_lemigas",
        ].includes(item.status),
      ) ? (
        <p className="text-xs text-muted-foreground">
          Selesaikan atau batalkan adendum yang sedang diproses sebelum membuat
          adendum baru.
        </p>
      ) : null}
      {list.error ? (
        <p role="alert" className="text-sm text-destructive">
          {list.error.message}
        </p>
      ) : list.isPending ? (
        <p className="text-sm text-muted-foreground">Memuat adendum...</p>
      ) : !list.data?.length ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Belum ada adendum untuk kontrak ini.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor adendum & progres</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Revisi</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="min-w-[400px]">
                    <p className="mb-3 font-semibold">{item.nomor}</p>
                    {item.status === "dibatalkan" ? (
                      <p className="text-xs text-muted-foreground">
                        Adendum dibatalkan
                      </p>
                    ) : item.status === "diakhiri" ? (
                      <p className="text-xs text-muted-foreground">
                        Adendum diakhiri
                      </p>
                    ) : (
                      <AddendumProgress status={item.status} />
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        item.status === "efektif"
                          ? "ok"
                          : item.status === "dibatalkan"
                            ? "neutral"
                            : "warn"
                      }
                    >
                      {labels[item.status] ?? item.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{item.revision}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => open("detail", item)}
                    >
                      Lihat detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Modal
        open={Boolean(mode)}
        onClose={() => !mutation.isPending && setMode(null)}
        title={mode ? titles[mode] : "Adendum"}
        description={
          selected
            ? `${selected.nomor} · Kontrak ${contract.nomor}`
            : `Kontrak ${contract.nomor}`
        }
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode(null)}
            >
              Tutup
            </Button>
            {mode === "detail" && selected && canManage ? (
              <>
                {selected.status === "draft" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => open("edit", selected)}
                    >
                      Ubah draft
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => open("draft", selected)}
                    >
                      Unggah PDF
                    </Button>
                    <Button
                      type="button"
                      onClick={() => open("submit", selected)}
                    >
                      Ajukan persetujuan
                    </Button>
                  </>
                ) : null}
                {selected.status === "menunggu_tanda_tangan_vendor" &&
                !selected.dikirimPada ? (
                  <Button type="button" onClick={() => open("send", selected)}>
                    Kirim ke vendor
                  </Button>
                ) : null}
                {selected.status === "finalisasi_lemigas" ? (
                  <Button
                    type="button"
                    onClick={() => open("finalize", selected)}
                  >
                    Finalisasi
                  </Button>
                ) : null}
                {[
                  "draft",
                  "menunggu_persetujuan",
                  "menunggu_tanda_tangan_vendor",
                ].includes(selected.status) ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => open("cancel", selected)}
                  >
                    Batalkan
                  </Button>
                ) : null}
              </>
            ) : null}
            {mode !== "detail" ? (
              <Button
                type="submit"
                form="addendum-form"
                disabled={
                  mutation.isPending ||
                  (mode === "edit" && !selectedFields.length)
                }
              >
                {mutation.isPending ? "Memproses..." : titles[mode!]}
              </Button>
            ) : null}
          </>
        }
      >
        <form
          id="addendum-form"
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            if (mode !== "detail") mutation.mutate();
          }}
        >
          {selected && mode === "detail" ? (
            <Detail addendum={selected} />
          ) : null}
          {mode === "edit" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nomor adendum</Label>
                  <Input
                    required
                    value={nomor}
                    onChange={(e) => setNomor(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Alasan perubahan</Label>
                  <Input
                    required
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Pilih bagian yang berubah, lalu isi nilai baru. Bagian lain
                tetap mengikuti kontrak.
              </p>
              <div className="grid gap-x-4 sm:grid-cols-2">
                {Object.entries(fields).map(([key, label]) => (
                  <div key={key} className="border-b py-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(key)}
                        onChange={(e) => {
                          setSelectedFields((current) =>
                            e.target.checked
                              ? [...current, key]
                              : current.filter((value) => value !== key),
                          );
                          if (e.target.checked && !(key in values))
                            setValues((current) => ({
                              ...current,
                              [key]:
                                key === "berakhirPada"
                                  ? localDate(contract.berakhirPada)
                                  : String(
                                      (
                                        contract as unknown as Record<
                                          string,
                                          unknown
                                        >
                                      )[key] ?? "",
                                    ),
                            }));
                        }}
                      />
                      {label}
                    </label>
                    {selectedFields.includes(key) ? (
                      <div className="mt-2">
                        <p className="mb-1 text-xs text-muted-foreground">
                          Saat ini:{" "}
                          {display(
                            (contract as unknown as Record<string, unknown>)[
                              key
                            ],
                            key,
                          )}
                          {key === "berakhirPada"
                            ? " · Kosongkan jika tidak dibatasi"
                            : ""}
                        </p>
                        <Input
                          type={
                            key === "berakhirPada"
                              ? "datetime-local"
                              : key === "nilai" || key === "volumeKontrak"
                                ? "number"
                                : "text"
                          }
                          step={
                            key === "nilai" || key === "volumeKontrak"
                              ? "any"
                              : undefined
                          }
                          required={key !== "berakhirPada"}
                          value={values[key] ?? ""}
                          onChange={(e) =>
                            setValues({ ...values, [key]: e.target.value })
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
          {selected && ["submit", "send"].includes(mode ?? "") ? (
            <>
              <Detail addendum={selected} />
              <p className="text-sm text-muted-foreground">
                {mode === "submit"
                  ? "Pastikan PDF draft sesuai dengan perubahan di atas."
                  : "Vendor akan dapat melihat dan menandatangani PDF yang telah disetujui."}
              </p>
            </>
          ) : null}
          {mode === "cancel" ? (
            <div className="space-y-1">
              <Label>Alasan pembatalan</Label>
              <textarea
                required
                className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
              />
            </div>
          ) : null}
          {mode === "draft" || mode === "finalize" ? (
            <>
              <UploadDocumentField
                key={mode}
                id="adendum-pdf"
                accept="application/pdf,.pdf"
                helperText="PDF · Maksimal 20 MB"
                onFileChange={setFile}
              />
              {mode === "finalize" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Unggah PDF yang telah ditandatangani kedua pihak. Tanggal
                    berlaku harus setelah kedua tanda tangan dan tidak di masa
                    depan. Perubahan diterapkan saat finalisasi.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["nama", "Nama penandatangan", "text"],
                        ["jabatan", "Jabatan", "text"],
                        ["email", "Email (opsional)", "email"],
                        [
                          "tanggal",
                          "Tanggal tanda tangan (WIB)",
                          "datetime-local",
                        ],
                        ["berlaku", "Berlaku sejak (WIB)", "datetime-local"],
                      ] as const
                    ).map(([key, label, type]) => (
                      <div key={key} className="space-y-1">
                        <Label>{label}</Label>
                        <Input
                          type={type}
                          required={key !== "email"}
                          value={signer[key]}
                          onChange={(e) =>
                            setSigner({ ...signer, [key]: e.target.value })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {mutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          ) : null}
        </form>
      </Modal>
    </section>
  );
}

export function AdendumApprovals() {
  const [selected, setSelected] = useState<Addendum | null>(null);
  const [revision, setRevision] = useState(false);
  const [note, setNote] = useState("");
  const list = use_query<Addendum[], Error, string>({
    tag: "contract",
    method: "adendum-approvals",
    params: "inbox",
    queryFn: async () => {
      setBrowserToken();
      return unwrap<Addendum[]>(
        await apiData(
          browserApi.request({
            path: "/api/adendum-approvals",
            method: "GET",
            secure: true,
            format: "json",
          }),
        ),
      );
    },
  });
  const mutation = use_mutation<unknown, Error, "disetujui" | "revisi">({
    tag: "contract",
    method: "adendum-decision",
    invalidateKeys: [
      apiQueryKeys.resource("contract"),
      apiQueryKeys.resource("notifikasi"),
      apiQueryKeys.resource("auditLog"),
    ],
    mutationFn: (decision) => {
      if (!selected?.kontrak) throw new Error("Data kontrak tidak tersedia.");
      return request(
        `${baseUrl(selected.kontrak.pengadaanId, selected.kontrak.id)}/${encodeURIComponent(selected.id)}/decision`,
        "POST",
        {
          expectedRevision: selected.revision,
          decision,
          ...(decision === "revisi" ? { catatan: note.trim() } : {}),
        },
      );
    },
    onSuccess: () => {
      setSelected(null);
      void list.refetch();
    },
  });
  return (
    <section className="space-y-3 border-t pt-5">
      <div>
        <h3 className="font-semibold">Persetujuan adendum</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Periksa perubahan dan PDF sebelum memutuskan.
        </p>
      </div>
      {list.error ? (
        <p className="text-sm text-destructive">{list.error.message}</p>
      ) : !list.data?.length ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Tidak ada adendum yang menunggu persetujuan.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Adendum</TableHead>
                <TableHead>Kontrak / pengadaan</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="min-w-[400px]">
                    <p className="mb-3 font-semibold">{item.nomor}</p>
                    {item.status === "dibatalkan" ||
                    item.status === "diakhiri" ? (
                      <p className="text-xs text-muted-foreground">
                        {labels[item.status] ?? item.status}
                      </p>
                    ) : (
                      <AddendumProgress status={item.status} />
                    )}
                  </TableCell>
                  <TableCell>
                    {item.kontrak?.nomor} · {item.kontrak?.pengadaan?.judul}
                  </TableCell>
                  <TableCell>{item.kontrak?.vendor?.nama ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        mutation.reset();
                        setNote("");
                        setRevision(false);
                        setSelected(item);
                      }}
                    >
                      Lihat detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => !mutation.isPending && setSelected(null)}
        title={`Persetujuan adendum ${selected?.nomor ?? ""}`}
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(null)}
            >
              Tutup
            </Button>
            {revision ? (
              <Button
                type="button"
                variant="destructive"
                disabled={!note.trim() || mutation.isPending}
                onClick={() => mutation.mutate("revisi")}
              >
                Kirim revisi
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRevision(true)}
                >
                  Minta revisi
                </Button>
                <Button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate("disetujui")}
                >
                  Setujui
                </Button>
              </>
            )}
          </>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <Detail addendum={selected} />
            {revision ? (
              <div className="space-y-1">
                <Label>Catatan revisi</Label>
                <textarea
                  className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            ) : null}
            {mutation.error ? (
              <p role="alert" className="text-sm text-destructive">
                {mutation.error.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export function VendorAddenda({
  addenda,
  pengadaanId,
  contractId,
  onRefresh,
}: {
  addenda: Addendum[];
  pengadaanId: string;
  contractId: string;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<Addendum | null>(null);
  const [mode, setMode] = useState<"detail" | "sign" | "revision">("detail");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [signer, setSigner] = useState({
    nama: "",
    jabatan: "",
    email: "",
    tanggal: "",
  });
  const mutation = use_mutation<unknown, Error, void>({
    tag: "vendor",
    method: "adendum-response",
    invalidateKeys: [
      apiQueryKeys.resource("vendor"),
      apiQueryKeys.resource("contract"),
      apiQueryKeys.resource("notifikasi"),
    ],
    mutationFn: () => {
      if (!selected) throw new Error("Adendum tidak ditemukan.");
      const base = `/api/vendor/me/contracts/${encodeURIComponent(pengadaanId)}/${encodeURIComponent(contractId)}/addenda/${encodeURIComponent(selected.id)}`;
      if (mode === "revision")
        return request(`${base}/revision`, "POST", {
          expectedRevision: selected.revision,
          alasan: reason.trim(),
        });
      if (!file) throw new Error("Pilih PDF bertanda tangan.");
      const body = new FormData();
      body.append("file", file);
      body.append("expectedRevision", String(selected.revision));
      body.append("penandatanganNama", signer.nama);
      body.append("penandatanganJabatan", signer.jabatan);
      if (signer.email) body.append("penandatanganEmail", signer.email);
      body.append("tanggalTandaTangan", isoDate(signer.tanggal));
      return request(`${base}/signed-document`, "POST", body);
    },
    onSuccess: () => {
      setSelected(null);
      onRefresh();
    },
  });
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Adendum kontrak</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Perubahan kontrak yang dikirim untuk perusahaan Anda.
        </p>
      </div>
      {!addenda.length ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Belum ada adendum yang dikirim.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addenda.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="min-w-[400px]">
                    <p className="mb-3 font-semibold">{item.nomor}</p>
                    {item.status === "dibatalkan" ||
                    item.status === "diakhiri" ? (
                      <p className="text-xs text-muted-foreground">
                        {labels[item.status] ?? item.status}
                      </p>
                    ) : (
                      <AddendumProgress status={item.status} />
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={
                        item.status === "efektif"
                          ? "ok"
                          : item.status === "dibatalkan"
                            ? "neutral"
                            : "warn"
                      }
                    >
                      {labels[item.status] ?? item.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        mutation.reset();
                        setReason("");
                        setFile(null);
                        setSigner({
                          nama: "",
                          jabatan: "",
                          email: "",
                          tanggal: "",
                        });
                        setMode("detail");
                        setSelected(item);
                      }}
                    >
                      Lihat detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Modal
        open={Boolean(selected)}
        onClose={() => !mutation.isPending && setSelected(null)}
        title={`Adendum ${selected?.nomor ?? ""}`}
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(null)}
            >
              Tutup
            </Button>
            {mode === "detail" &&
            selected?.status === "menunggu_tanda_tangan_vendor" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMode("revision")}
                >
                  Minta revisi
                </Button>
                <Button type="button" onClick={() => setMode("sign")}>
                  Unggah adendum bertanda tangan
                </Button>
              </>
            ) : null}
            {mode !== "detail" ? (
              <Button
                type="submit"
                form="vendor-addendum-form"
                disabled={mutation.isPending}
              >
                Kirim
              </Button>
            ) : null}
          </>
        }
      >
        <form
          id="vendor-addendum-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          {selected ? <Detail addendum={selected} /> : null}
          {mode === "revision" ? (
            <div className="space-y-1">
              <Label>Alasan revisi</Label>
              <textarea
                className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          ) : null}
          {mode === "sign" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["nama", "Nama penandatangan", "text"],
                    ["jabatan", "Jabatan", "text"],
                    ["email", "Email (opsional)", "email"],
                    ["tanggal", "Tanggal tanda tangan (WIB)", "datetime-local"],
                  ] as const
                ).map(([key, label, type]) => (
                  <div key={key} className="space-y-1">
                    <Label>{label}</Label>
                    <Input
                      type={type}
                      required={key !== "email"}
                      value={signer[key]}
                      onChange={(e) =>
                        setSigner({ ...signer, [key]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
              <UploadDocumentField
                id="vendor-addendum-pdf"
                accept="application/pdf,.pdf"
                helperText="PDF · Maksimal 20 MB"
                onFileChange={setFile}
              />
            </>
          ) : null}
          {mutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          ) : null}
        </form>
      </Modal>
    </section>
  );
}
