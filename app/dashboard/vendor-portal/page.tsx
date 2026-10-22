"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileUp, Send, Clock3, FileText, CircleCheck } from "lucide-react";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { EmptyData } from "@/components/loading/EmptyData";
import { Button } from "@/components/ui/Button";
import { UploadDocumentField } from "@/components/documents/DocumentControls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

type VendorDoc = { id: string; jenis: string; status: string; filePath: string; expiresAt?: string | null };
type Portal = {
  id: string;
  status: string;
  rejectionReason?: string | null;
  revision?: unknown;
  vendor: { id: string; nama: string; alamat?: string | null; telepon?: string | null; email?: string | null; npwp?: string | null; contactPerson?: string | null; vendorDocuments: VendorDoc[] };
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
  submittedAt?: string | null;
  updatedAt?: string | null;
};
type Rfq = {
  id: string;
  penawaran?: VendorOffer[];
  nomor: string;
  revisi?: number;
  revisiDariId?: string | null;
  alasanPerubahan?: string | null;
  batasRespons?: string | null;
  ketentuan?: Record<string, unknown> | null;
  pengadaan: { id: string; nomorSurat: string; judul: string; status: string };
};
const DOCUMENT_TYPES = ["NIB", "LEGALITAS", "NPWP", "Akta Perusahaan", "Surat Domisili", "Rekening Bank", "Surat Kuasa / Penunjukan Penandatangan"] as const;

type Negotiation = {
  id: string;
  putaran: number;
  batasNegosiasi?: string | number | null;
  hargaAcuan?: string | null;
  totalBiayaPerolehan?: string | number | null;
  hasil?: string | null;
  tanggapanVendor?: string | null;
  catatanVendor?: string | null;
  penawaran: { mataUang: string; nomorRfq?: string | null; pengadaan: { id: string; nomorSurat: string; judul: string } };
};
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
  const response = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token()}`, ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message ?? `Request gagal (${response.status})`);
  return payload;
}

function normalizedRfqTerm(key: string, value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : value;
}
function formatRfqValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
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
    const simple = preferred.find((key) => record[key] !== undefined && (typeof record[key] !== "object" || record[key] === null));
    if (simple) return formatRfqValue(record[simple]);
    return (
      Object.entries(record)
        .filter(([, item]) => item !== null && item !== undefined && item !== "")
        .map(([key, item]) => `${key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())}: ${formatRfqValue(item)}`)
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
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}
function structuredRows(value: unknown): Array<[string, unknown]> | null {
  if (Array.isArray(value)) {
    const rows = value.map((item, index) => [String(index + 1), item] as [string, unknown]);
    return rows.length ? rows : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = ["value", "label", "nama", "name", "text", "detail"];
    if (preferred.some((key) => record[key] !== undefined && (typeof record[key] !== "object" || record[key] === null))) return null;
    const rows = Object.entries(record).filter(([, item]) => item !== null && item !== undefined && item !== "");
    return rows.length ? rows : null;
  }
  if (typeof value === "string" && value.includes(":")) {
    const rows = value
      .split(/\\r?\\n|\\s+·\\s+/)
      .map((part) => {
        const separator = part.indexOf(":");
        return separator < 0 ? null : ([part.slice(0, separator).trim(), part.slice(separator + 1).trim()] as [string, unknown]);
      })
      .filter((row): row is [string, unknown] => Boolean(row && row[0] && row[1]));
    return rows.length ? rows : null;
  }
  return null;
}
function VendorPortalView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedSection = searchParams?.get("section");
  const selectedRfqId = searchParams?.get("rfq");
  const openRfq = (rfqId?: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("section", "rfq");
    if (rfqId) params.set("rfq", rfqId);
    else params.delete("rfq");
    router.push(`/dashboard/vendor-portal?${params.toString()}`, { scroll: false });
  };
  const section = selectedSection === "rfq" ? "rfq" : selectedSection === "negotiation" ? "negotiation" : "profile";
  const [profile, setProfile] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [filesByType, setFilesByType] = useState<Record<string, File | null>>({});
  const { toast } = useToast();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const currencyConfig: Record<string, { prefix: string; locale: string; currency: string }> = {
    IDR: { prefix: "Rp", locale: "id-ID", currency: "IDR" },
    USD: { prefix: "$", locale: "en-US", currency: "USD" },
    RUB: { prefix: "₽", locale: "ru-RU", currency: "RUB" },
  };
  const formatMoneyInput = (raw: string, code: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat(currencyConfig[code]?.locale ?? "en-US", { maximumFractionDigits: 0 }).format(Number(digits));
  };
  const [quoteAmount, setQuoteAmount] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await request<{ data: Portal }>("/api/vendor-onboarding/me");
      setProfile(result.data);
      if (result.data.status === "approved") {
        const [list, negotiationList] = await Promise.all([request<{ data: Rfq[] }>("/api/vendor-onboarding/me/rfqs"), request<{ data: Negotiation[] }>("/api/vendor-onboarding/me/negotiations")]);
        setRfqs(list.data ?? []);
        setNegotiations(negotiationList.data ?? []);
      } else {
        setRfqs([]);
        setNegotiations([]);
      }
    } catch (e) {
      toast({ title: "Gagal memuat portal", description: e instanceof Error ? e.message : "Gagal memuat portal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const prior = rfqs.find((item) => item.id === selectedRfqId)?.penawaran?.[0];
    setQuoteCurrency(prior?.mataUang ?? "USD");
    setQuoteAmount(prior?.hargaPenawaran == null ? "" : formatMoneyInput(String(prior.hargaPenawaran), prior.mataUang));
  }, [rfqs, selectedRfqId]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    try {
      const result = await request<{ message?: string }>("/api/vendor-onboarding/me/profile", { method: "PUT", body: JSON.stringify(values) });
      const message = result.message || "Profil tersimpan.";
      setNotice(message);
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Profil gagal disimpan";
      toast({ title: "Profil gagal disimpan", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }
  async function uploadDocument(jenis: string) {
    const file = filesByType[jenis];
    if (!file) {
      toast({ title: "Dokumen belum dipilih", description: `Pilih file untuk dokumen ${jenis}.`, variant: "destructive" });
      return;
    }
    setBusy(true);
    setNotice("");
    const form = new FormData();
    form.append("file", file);
    form.append("jenis", jenis);
    try {
      const result = await request<{ message?: string }>("/api/vendor-onboarding/me/documents", { method: "POST", body: form });
      const message = result.message || `${jenis} berhasil diunggah.`;
      setFilesByType((current) => ({ ...current, [jenis]: null }));
      setNotice(message);
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : `Dokumen ${jenis} gagal diunggah`;
      toast({ title: "Unggah dokumen gagal", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }
  async function submitOnboarding() {
    setBusy(true);
    setNotice("");
    try {
      const result = await request<{ message?: string }>("/api/vendor-onboarding/me/submit", { method: "POST" });
      const message = result.message || "Onboarding dikirim untuk review.";
      setNotice(message);
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Pengajuan gagal";
      toast({ title: "Pengajuan gagal", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    try {
      const response = await fetch(`${API}/api/vendor-onboarding/documents/${id}/file`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!response.ok) throw new Error("File tidak dapat diunduh");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `dokumen-${id}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ title: "Unduh gagal", description: e instanceof Error ? e.message : "Unduh gagal", variant: "destructive" });
    }
  }
  async function respondNegotiation(item: Negotiation, tanggapan: "diterima" | "ditolak") {
    setBusy(true);
    setNotice("");
    try {
      await request(`/api/vendor-onboarding/me/negotiations/${item.id}/respond`, {
        method: "POST",
        body: JSON.stringify({ tanggapan }),
      });
      setNotice(`Negosiasi putaran ${item.putaran} ${tanggapan}.`);
      await refresh();
    } catch (e) {
      toast({ title: "Tanggapan negosiasi gagal", description: e instanceof Error ? e.message : "Tanggapan negosiasi gagal disimpan", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>, rfq: Rfq) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const amount = Number(String(form.get("hargaPenawaran") ?? "").replace(/[^\d]/g, ""));
    try {
      await request(`/api/pengadaan/${rfq.pengadaan.id}/penawaran`, {
        method: "POST",
        body: JSON.stringify({
          rfqId: rfq.id,
          nomorRfq: rfq.nomor,
          hargaPenawaran: amount,
          mataUang: String(form.get("mataUang") || "USD"),
          berlakuSampai: form.get("berlakuSampai") || undefined,
          syaratPembayaran: form.get("syaratPembayaran") || undefined,
          ketentuanPengangkutan: form.get("ketentuanPengangkutan") || undefined,
          detail: { spesifikasi: form.get("spesifikasi"), volume: form.get("volume"), satuan: form.get("satuan"), catatan: form.get("catatan") },
        }),
      });
      setNotice(`Penawaran untuk ${rfq.nomor} berhasil dikirim.`);
      event.currentTarget.reset();
      setQuoteAmount("");
      await refresh();
    } catch (e) {
      toast({ title: "Penawaran gagal dikirim", description: e instanceof Error ? e.message : "Penawaran gagal dikirim", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={section === "profile" ? "Profil & Dokumen" : section === "rfq" ? "RFQ & Penawaran" : "Negosiasi"}
        description={section === "profile" ? "Kelola profil perusahaan dan dokumen legalitas." : section === "rfq" ? "Tinjau kebutuhan, ketentuan, dan tenggat sebelum mengirim penawaran." : "Tanggapi putaran negosiasi dari tim pengadaan."}
      />
      {notice && (
        <div role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          {notice}
        </div>
      )}
      {loading ? (
        <LoadingState label="Memuat portal vendor…" />
      ) : !profile ? (
        <div className="rounded-xl border border-border/70 bg-card p-5 text-sm text-muted-foreground shadow-sm">Portal belum dapat dimuat. Periksa koneksi dan status akun, lalu coba muat ulang halaman.</div>
      ) : (
        <>
          {section === "profile" && (
            <>
              <article id="beranda" className="scroll-mt-6 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{profile.vendor.nama}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Status verifikasi: <strong className="capitalize text-foreground">{profile.status.replaceAll("_", " ")}</strong>
                    </p>
                  </div>
                  <StatusBadge status={profile.status === "approved" ? "ok" : profile.status === "requires_revision" || profile.status === "rejected" ? "danger" : "warn"}>
                    {profile.status === "approved" ? "Akses sourcing aktif" : "Akses penawaran terkunci"}
                  </StatusBadge>
                </div>
                {profile.rejectionReason && <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Catatan reviewer: {profile.rejectionReason}</p>}
                <div className="mt-5 grid gap-4 border-t border-border/70 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <div>
                    <h3 className="text-sm font-semibold">Profil perusahaan</h3>
                    <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Email</dt>
                        <dd className="break-words">{profile.vendor.email || "Belum diisi"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Telepon</dt>
                        <dd>{profile.vendor.telepon || "Belum diisi"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">NPWP</dt>
                        <dd>{profile.vendor.npwp || "Belum diisi"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Kontak</dt>
                        <dd>{profile.vendor.contactPerson || "Belum diisi"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">Alamat</dt>
                        <dd>{profile.vendor.alamat || "Belum diisi"}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Dokumen perusahaan</h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {profile.vendor.vendorDocuments.length ? (
                        profile.vendor.vendorDocuments.map((doc) => (
                          <li key={doc.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
                            <span className="min-w-0 truncate">{doc.jenis}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <StatusBadge status={doc.status === "approved" ? "ok" : doc.status === "rejected" ? "danger" : "warn"}>{doc.status}</StatusBadge>
                              <button type="button" onClick={() => void download(doc.id)} className="text-primary underline">
                                Lihat
                              </button>
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-muted-foreground">Belum ada dokumen diunggah.</li>
                      )}
                    </ul>
                  </div>
                </div>
                <div className="mt-5 border-t border-border/70 pt-5">
                  <h3 className="text-center text-sm font-semibold">Proses verifikasi</h3>
                  <ol className="mx-auto mt-5 grid max-w-5xl grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4 sm:gap-x-6">
                    {[
                      { title: "Profil perusahaan", done: true },
                      { title: "Dokumen legalitas", done: profile.vendor.vendorDocuments.length > 0 },
                      { title: "Review LEMIGAS", done: ["submitted", "approved", "requires_revision", "rejected"].includes(profile.status), active: profile.status === "submitted" },
                      { title: "Verifikasi selesai", done: profile.status === "approved" },
                    ].map((step, index) => (
                      <li key={step.title} className="relative flex flex-col items-center gap-2 text-center">
                        {index < 3 && <span aria-hidden="true" className="absolute left-[calc(50%+15px)] right-[calc(-50%+15px)] top-3.5 hidden h-px bg-border sm:block" />}
                        <span
                          className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${step.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                        >
                          {step.done ? "✓" : index + 1}
                        </span>
                        <span className={`max-w-full text-sm leading-snug ${step.active ? "font-semibold text-primary" : step.done ? "font-medium" : "text-muted-foreground"}`}>
                          {step.title}
                          {step.active ? " · Sedang diproses" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </article>
              {["draft", "requires_revision", "rejected"].includes(profile.status) && (
                <>
                  <details id="profil-perusahaan" className="scroll-mt-6 rounded-xl border border-border/70 bg-card shadow-sm">
                    <summary className="cursor-pointer px-5 py-4 text-lg font-semibold">
                      Profil perusahaan <span className="ml-2 text-sm font-normal text-muted-foreground">Ubah data perusahaan</span>
                    </summary>
                    <form onSubmit={saveProfile} className="space-y-4 border-t px-5 py-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-1 text-sm">
                          Email perusahaan
                          <input name="email" type="email" defaultValue={profile.vendor.email ?? ""} className="w-full rounded-md border bg-background p-2" />
                        </label>
                        <label className="space-y-1 text-sm">
                          Telepon
                          <input name="telepon" defaultValue={profile.vendor.telepon ?? ""} className="w-full rounded-md border bg-background p-2" />
                        </label>
                        <label className="space-y-1 text-sm">
                          NPWP
                          <input name="npwp" defaultValue={profile.vendor.npwp ?? ""} className="w-full rounded-md border bg-background p-2" />
                        </label>
                        <label className="space-y-1 text-sm">
                          Nama kontak
                          <input name="contactPerson" defaultValue={profile.vendor.contactPerson ?? ""} className="w-full rounded-md border bg-background p-2" />
                        </label>
                        <label className="space-y-1 text-sm sm:col-span-2">
                          Alamat
                          <textarea name="alamat" defaultValue={profile.vendor.alamat ?? ""} rows={2} className="w-full rounded-md border bg-background p-2" />
                        </label>
                      </div>
                      <Button type="submit" disabled={busy}>
                        Simpan profil
                      </Button>
                    </form>
                  </details>
                  <section id="profil-dokumen" className="scroll-mt-6 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                    <div className="border-b border-border/70 px-5 py-5 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Langkah 2 dari 2</p>
                          <h2 className="mt-1 text-xl font-semibold">Dokumen legalitas</h2>
                          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Unggah file langsung pada bagian jenis dokumen yang sesuai. Format PDF, JPG, atau PNG; maksimal 10 MB.</p>
                        </div>
                        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{profile.vendor.vendorDocuments.length} dokumen diunggah</span>
                      </div>
                    </div>
                    <div className="space-y-6 p-5 sm:p-6">
                      <div>
                        <h3 className="text-sm font-semibold">Daftar dan unggah dokumen</h3>
                        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {DOCUMENT_TYPES.map((type) => {
                            const docs = profile.vendor.vendorDocuments.filter((doc) => doc.jenis === type);
                            return (
                              <li key={type} className="space-y-3 rounded-lg border border-border/70 bg-background p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 text-sm">
                                    <p className="font-semibold">{type}</p>
                                    {docs.length ? (
                                      docs.map((doc) => (
                                        <div key={doc.id} className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                          <StatusBadge status={doc.status === "approved" ? "ok" : doc.status === "rejected" ? "danger" : "warn"}>{doc.status}</StatusBadge>
                                          <button type="button" onClick={() => void download(doc.id)} className="text-primary underline">
                                            Lihat file
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="mt-1 text-xs text-muted-foreground">Belum diunggah</p>
                                    )}
                                  </div>
                                  <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${docs.length ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                                    {docs.length ? "✓" : "·"}
                                  </span>
                                </div>
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void uploadDocument(type);
                                  }}
                                  className="space-y-2 border-t border-border/60 pt-3"
                                >
                                  <UploadDocumentField id={`vendor-document-${DOCUMENT_TYPES.indexOf(type)}`} required={false} onFileChange={(selected) => setFilesByType((current) => ({ ...current, [type]: selected }))} disabled={busy} />
                                  <Button type="submit" variant="outline" disabled={busy || !filesByType[type]} className="w-full">
                                    <FileUp size={16} /> Unggah {type}
                                  </Button>
                                </form>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      {profile.vendor.vendorDocuments.some((doc) => !DOCUMENT_TYPES.includes(doc.jenis as (typeof DOCUMENT_TYPES)[number])) && (
                        <div className="rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 text-sm">
                          <p className="font-medium">Dokumen lama perlu dipetakan</p>
                          <p className="mt-1 text-xs text-muted-foreground">Dokumen lama tetap tersimpan dan dapat dibuka. Unggah penggantinya pada kategori resmi di atas.</p>
                          {profile.vendor.vendorDocuments
                            .filter((doc) => !DOCUMENT_TYPES.includes(doc.jenis as (typeof DOCUMENT_TYPES)[number]))
                            .map((doc) => (
                              <div key={doc.id} className="mt-2 flex justify-between gap-2 text-muted-foreground">
                                <span>
                                  {doc.jenis} · {doc.status}
                                </span>
                                <button type="button" onClick={() => void download(doc.id)} className="text-primary underline">
                                  Lihat file
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                      <div className="border-t pt-4">
                        <Button type="button" disabled={busy || profile.vendor.vendorDocuments.length === 0} onClick={() => void submitOnboarding()}>
                          <Send size={16} /> Ajukan verifikasi
                        </Button>
                      </div>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
          {section === "rfq" && profile.status !== "approved" && (
            <>
              <section id="rfq-penawaran" className="scroll-mt-6 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground">Fitur ini terbuka setelah verifikasi perusahaan disetujui. Setelah aktif, RFQ yang ditujukan kepada perusahaan Anda akan tampil di sini.</p>
              </section>
            </>
          )}
          {section === "negotiation" && profile.status === "approved" && (
            <section id="negosiasi" className="space-y-4 scroll-mt-6">
              {negotiations.length === 0 ? (
                <EmptyData className="min-h-48 border-border/70 bg-card/70 shadow-sm" label="Belum ada negosiasi untuk ditanggapi." />
              ) : (
                negotiations.map((item) => (
                  <article key={item.id} className="space-y-3 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
                    <div>
                      <h3 className="font-semibold">{item.penawaran.pengadaan.judul}</h3>
                      <p className="text-sm text-muted-foreground">
                        {item.penawaran.pengadaan.nomorSurat} · RFQ {item.penawaran.nomorRfq ?? "-"} · Putaran {item.putaran}
                      </p>
                    </div>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Batas negosiasi</dt>
                        <dd>
                          {item.batasNegosiasi ?? "-"} {item.penawaran.mataUang}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Total biaya perolehan</dt>
                        <dd>
                          {item.totalBiayaPerolehan ?? "-"} {item.penawaran.mataUang}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">Hasil/catatan</dt>
                        <dd>{item.hasil || "Tidak ada catatan"}</dd>
                      </div>
                    </dl>
                    {item.tanggapanVendor ? (
                      <p className="text-sm">
                        Tanggapan Anda: <strong className="capitalize">{item.tanggapanVendor}</strong>
                        {item.catatanVendor ? ` · ${item.catatanVendor}` : ""}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <Button type="button" disabled={busy} onClick={() => void respondNegotiation(item, "diterima")}>
                          Terima
                        </Button>
                        <Button type="button" variant="outline" disabled={busy} onClick={() => void respondNegotiation(item, "ditolak")}>
                          Tolak
                        </Button>
                      </div>
                    )}
                  </article>
                ))
              )}
            </section>
          )}
          {section === "rfq" && profile.status === "approved" && (
            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <article className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FileText size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">RFQ aktif</p>
                    <p className="font-semibold">{rfqs.length} RFQ</p>
                  </div>
                </article>
                <article className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Clock3 size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Tenggat terdekat</p>
                    <p className="font-semibold">
                      {rfqs.some((item) => item.batasRespons) ? new Date(Math.min(...rfqs.filter((item) => item.batasRespons).map((item) => new Date(item.batasRespons!).getTime()))).toLocaleDateString("id-ID") : "Tidak ditentukan"}
                    </p>
                  </div>
                </article>
                <article className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700">
                    <CircleCheck size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">Langkah berikutnya</p>
                    <p className="font-semibold">Tinjau dan kirim</p>
                  </div>
                </article>
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                <strong>Alur penawaran</strong>
                <ol className="mt-2 grid gap-2 sm:grid-cols-3">
                  <li>1. Periksa detail dan tenggat RFQ.</li>
                  <li>2. Isi harga, spesifikasi, volume, dan syarat.</li>
                  <li>3. Kirim penawaran; tunggu tindak lanjut tim pengadaan.</li>
                </ol>
              </div>
              {rfqs.length === 0 ? (
                <EmptyData className="min-h-48 border-border/70 bg-card/70 shadow-sm" label="Belum ada RFQ aktif untuk vendor ini." />
              ) : selectedRfqId ? (
                (() => {
                  const rfq = rfqs.find((item) => item.id === selectedRfqId);
                  if (!rfq)
                    return (
                      <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
                        <p>RFQ tidak ditemukan atau sudah tidak aktif.</p>
                        <Button type="button" variant="outline" className="mt-3" onClick={() => openRfq()}>
                          Kembali ke daftar RFQ
                        </Button>
                      </div>
                    );
                  const expired = Boolean(rfq.batasRespons && new Date(rfq.batasRespons).getTime() < Date.now());
                  const priorOffers = rfq.penawaran ?? [];
                  const priorOffer = priorOffers[0];
                  const priorDetail = priorOffer?.detail ?? {};
                  const dateInputValue = priorOffer?.berlakuSampai ? new Date(priorOffer.berlakuSampai).toISOString().slice(0, 10) : "";
                  const terms = Object.entries(rfq.ketentuan ?? {})
                    .map(([key, value]) => [key, normalizedRfqTerm(key, value)] as const)
                    .filter(([, value]) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0));
                  return (
                    <div key={rfq.id} className="space-y-3">
                      <Button type="button" variant="outline" onClick={() => openRfq()}>
                        ← Kembali ke daftar RFQ
                      </Button>
                      <article className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                        <header className="border-b bg-muted/20 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                {rfq.pengadaan.nomorSurat} · RFQ {rfq.nomor} · Revisi {rfq.revisi ?? 1}
                              </p>
                              <h2 className="mt-1 text-lg font-semibold">{rfq.pengadaan.judul}</h2>
                            </div>
                            <StatusBadge status={expired ? "danger" : "warn"}>{expired ? "Tenggat lewat" : "Menunggu penawaran"}</StatusBadge>
                          </div>
                          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock3 size={15} /> Batas respons: {rfq.batasRespons ? new Date(rfq.batasRespons).toLocaleString("id-ID") : "Tidak ditentukan"}
                          </p>
                          {rfq.alasanPerubahan && <p className="mt-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900">Perubahan: {rfq.alasanPerubahan}</p>}
                        </header>
                        <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr]">
                          <section className="space-y-3">
                            <h3 className="flex items-center gap-2 font-semibold">
                              <FileText size={17} /> Ketentuan dan kebutuhan
                            </h3>
                            {terms.length ? (
                              <div className="space-y-3">
                                <dl className="grid gap-2 sm:grid-cols-2">
                                  {terms
                                    .filter(([, value]) => !structuredRows(value))
                                    .map(([key, value]) => (
                                      <div key={key} className="min-w-0 rounded-lg border bg-background px-3 py-2.5">
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{rfqTermLabel(key)}</dt>
                                        <dd className="mt-1 break-words whitespace-pre-wrap text-sm leading-6">{formatRfqValue(value)}</dd>
                                      </div>
                                    ))}
                                </dl>
                                {terms
                                  .filter(([, value]) => structuredRows(value))
                                  .map(([key, value]) => {
                                    const rows = structuredRows(value) ?? [];
                                    return (
                                      <section key={key} className="overflow-hidden rounded-lg border bg-background">
                                        <h4 className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide">{rfqTermLabel(key)}</h4>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="h-9 px-3 text-[11px]">Item</TableHead>
                                              <TableHead className="h-9 px-3 text-[11px]">Keterangan</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {rows.map(([name, item], index) => (
                                              <TableRow key={`${name}-${index}`}>
                                                <TableCell className="w-[35%] break-words px-3 py-2 text-xs font-medium">{name}</TableCell>
                                                <TableCell className="break-words whitespace-pre-wrap px-3 py-2 text-xs leading-5">{formatRfqValue(item)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </section>
                                    );
                                  })}
                              </div>
                            ) : (
                              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Ketentuan belum disertakan pada RFQ.</p>
                            )}
                          </section>
                          <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
                            <div>
                              <h3 className="font-semibold">{priorOffer ? "Revisi penawaran" : "Kirim penawaran"}</h3>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {priorOffer
                                  ? `Penawaran terakhir diperbarui ${priorOffer.updatedAt ? new Date(priorOffer.updatedAt).toLocaleString("id-ID") : ""}. Revisi akan mengganti penawaran aktif sebelumnya.`
                                  : `Belum ada penawaran untuk RFQ ${rfq.nomor}, revisi ${rfq.revisi ?? 1}.`}
                              </p>
                            </div>
                            {priorOffers.length > 0 && (
                              <div className="space-y-2 rounded-lg border bg-background p-3">
                                <p className="text-sm font-medium">Daftar penawaran Anda ({priorOffers.length})</p>
                                {priorOffers.map((offer, index) => (
                                  <div key={offer.id} className="flex flex-wrap justify-between gap-2 border-t pt-2 text-sm">
                                    <span>
                                      {index === 0 ? "Terbaru" : `Penawaran ${index + 1}`} · {offer.nomorRfq ?? rfq.nomor}
                                    </span>
                                    <span className="font-medium">
                                      {offer.mataUang} {Number(offer.hargaPenawaran ?? 0).toLocaleString("id-ID")} · {offer.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {expired ? (
                              <p className="text-sm text-destructive">Tenggat lewat. Pengiriman tidak tersedia.</p>
                            ) : (
                              <form key={priorOffer?.id ?? rfq.id} onSubmit={(e) => void submitQuote(e, rfq)} className="space-y-3">
                                <label className="block space-y-1 text-sm">
                                  Harga penawaran *
                                  <span className="flex overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/40">
                                    <span className="flex min-w-14 items-center justify-center border-r bg-muted/40 px-3 text-sm font-medium text-muted-foreground">{currencyConfig[quoteCurrency]?.prefix ?? quoteCurrency}</span>
                                    <input
                                      name="hargaPenawaran"
                                      type="text"
                                      required
                                      inputMode="numeric"
                                      value={quoteAmount}
                                      onChange={(event) => setQuoteAmount(formatMoneyInput(event.target.value, quoteCurrency))}
                                      placeholder="Masukkan jumlah"
                                      className="w-full min-w-0 bg-transparent px-3 py-2 text-sm outline-none"
                                    />
                                  </span>
                                </label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className="space-y-1 text-sm">
                                    Mata uang
                                    <select
                                      name="mataUang"
                                      value={quoteCurrency}
                                      onChange={(event) => {
                                        const nextCurrency = event.target.value;
                                        setQuoteCurrency(nextCurrency);
                                        setQuoteAmount((current) => formatMoneyInput(current, nextCurrency));
                                      }}
                                      className="w-full rounded-md border bg-background p-2"
                                    >
                                      <option value="IDR">IDR — Rupiah (Rp)</option>
                                      <option value="USD">USD — Dolar AS ($)</option>
                                      <option value="RUB">RUB — Rubel Rusia (₽)</option>
                                    </select>
                                  </label>
                                  <label className="space-y-1 text-sm">
                                    Berlaku sampai
                                    <input name="berlakuSampai" type="date" defaultValue={dateInputValue} className="w-full rounded-md border bg-background p-2" />
                                  </label>
                                </div>
                                <label className="block space-y-1 text-sm">
                                  Spesifikasi
                                  <input name="spesifikasi" defaultValue={String(priorDetail.spesifikasi ?? "")} className="w-full rounded-md border bg-background p-2" />
                                </label>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <label className="space-y-1 text-sm">
                                    Volume
                                    <input name="volume" defaultValue={String(priorDetail.volume ?? "")} className="w-full rounded-md border bg-background p-2" />
                                  </label>
                                  <label className="space-y-1 text-sm">
                                    Satuan
                                    <input name="satuan" defaultValue={String(priorDetail.satuan ?? "")} className="w-full rounded-md border bg-background p-2" />
                                  </label>
                                </div>
                                <label className="block space-y-1 text-sm">
                                  Syarat pembayaran
                                  <input name="syaratPembayaran" defaultValue={priorOffer?.syaratPembayaran ?? ""} className="w-full rounded-md border bg-background p-2" />
                                </label>
                                <label className="block space-y-1 text-sm">
                                  Ketentuan pengangkutan
                                  <input name="ketentuanPengangkutan" defaultValue={priorOffer?.ketentuanPengangkutan ?? ""} className="w-full rounded-md border bg-background p-2" />
                                </label>
                                <label className="block space-y-1 text-sm">
                                  Catatan
                                  <textarea name="catatan" rows={2} defaultValue={String(priorDetail.catatan ?? "")} className="w-full rounded-md border bg-background p-2" />
                                </label>
                                <Button type="submit" disabled={busy} className="w-full">
                                  <Send size={16} /> {priorOffer ? "Kirim revisi penawaran" : "Kirim penawaran"}
                                </Button>
                              </form>
                            )}
                          </section>
                        </div>
                      </article>
                    </div>
                  );
                })()
              ) : (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
                  <div className="border-b p-4">
                    <h2 className="font-semibold">Daftar RFQ</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Pilih RFQ untuk melihat ketentuan dan mengirim penawaran.</p>
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
                          const expired = Boolean(rfq.batasRespons && new Date(rfq.batasRespons).getTime() < Date.now());
                          return (
                            <tr key={rfq.id} className="hover:bg-muted/20">
                              <td className="px-4 py-3">
                                <p className="font-medium">{rfq.pengadaan.judul}</p>
                                <p className="text-xs text-muted-foreground">{rfq.pengadaan.nomorSurat}</p>
                              </td>
                              <td className="px-4 py-3 font-medium">{rfq.nomor}</td>
                              <td className="px-4 py-3">R{rfq.revisi ?? 1}</td>
                              <td className="px-4 py-3">{rfq.batasRespons ? new Date(rfq.batasRespons).toLocaleDateString("id-ID") : "Tidak ditentukan"}</td>
                              <td className="px-4 py-3">
                                <StatusBadge status={expired ? "danger" : "warn"}>{expired ? "Tenggat lewat" : "Menunggu penawaran"}</StatusBadge>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button type="button" variant="outline" size="sm" onClick={() => openRfq(rfq.id)}>
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
              <p className="mt-1 text-sm text-muted-foreground">Tanggapan negosiasi tersedia setelah onboarding disetujui dan tim pengadaan mengirim putaran negosiasi.</p>
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
