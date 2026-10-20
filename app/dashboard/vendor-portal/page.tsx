"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileUp, Send } from "lucide-react";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { EmptyData } from "@/components/loading/EmptyData";
import { Button } from "@/components/ui/Button";
import { UploadDocumentField } from "@/components/documents/DocumentControls";

type VendorDoc = { id: string; jenis: string; status: string; filePath: string; expiresAt?: string | null };
type Portal = {
  id: string;
  status: string;
  rejectionReason?: string | null;
  revision?: unknown;
  vendor: { id: string; nama: string; alamat?: string | null; telepon?: string | null; email?: string | null; npwp?: string | null; contactPerson?: string | null; vendorDocuments: VendorDoc[] };
};
type Rfq = { id: string; nomor: string; batasRespons?: string | null; pengadaan: { id: string; nomorSurat: string; judul: string; status: string } };
const DOCUMENT_TYPES = ["NIB", "NPWP", "Akta Perusahaan", "Surat Domisili", "Rekening Bank", "Lainnya"] as const;

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

function VendorPortalView() {
  const searchParams = useSearchParams();
  const selectedSection = searchParams?.get("section");
  const section = selectedSection === "rfq" ? "rfq" : selectedSection === "negotiation" ? "negotiation" : "profile";
  const [profile, setProfile] = useState<Portal | null>(null);
  const [loading, setLoading] = useState(true);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [filesByType, setFilesByType] = useState<Record<string, File | null>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setError("");
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
      setError(e instanceof Error ? e.message : "Gagal memuat portal");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setError("");
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
      setError(message);
      window.dispatchEvent(new CustomEvent("api:error", { detail: { message } }));
    } finally {
      setBusy(false);
    }
  }
  async function uploadDocument(jenis: string) {
    const file = filesByType[jenis];
    if (!file) {
      setError(`Pilih file untuk dokumen ${jenis}.`);
      return;
    }
    setBusy(true);
    setError("");
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
      setError(message);
      window.dispatchEvent(new CustomEvent("api:error", { detail: { message } }));
    } finally {
      setBusy(false);
    }
  }
  async function submitOnboarding() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request<{ message?: string }>("/api/vendor-onboarding/me/submit", { method: "POST" });
      const message = result.message || "Onboarding dikirim untuk review.";
      setNotice(message);
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Pengajuan gagal";
      setError(message);
      window.dispatchEvent(new CustomEvent("api:error", { detail: { message } }));
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
      setError(e instanceof Error ? e.message : "Unduh gagal");
    }
  }
  async function respondNegotiation(item: Negotiation, tanggapan: "diterima" | "ditolak") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/api/vendor-onboarding/me/negotiations/${item.id}/respond`, {
        method: "POST",
        body: JSON.stringify({ tanggapan }),
      });
      setNotice(`Negosiasi putaran ${item.putaran} ${tanggapan}.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tanggapan negosiasi gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>, rfq: Rfq) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("hargaPenawaran"));
    try {
      await request(`/api/pengadaan/${rfq.pengadaan.id}/penawaran`, {
        method: "POST",
        body: JSON.stringify({
          nomorRfq: rfq.nomor,
          hargaPenawaran: amount,
          mataUang: String(form.get("mataUang") || "USD"),
          berlakuSampai: form.get("berlakuSampai") || undefined,
          syaratPembayaran: form.get("syaratPembayaran") || undefined,
          ketentuanPengangkutan: form.get("ketentuanPengangkutan") || undefined,
        }),
      });
      setNotice(`Penawaran untuk ${rfq.nomor} berhasil dikirim.`);
      event.currentTarget.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Penawaran gagal dikirim");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={section === "profile" ? "Profil & Dokumen" : section === "rfq" ? "RFQ & Penawaran" : "Negosiasi"}
        description={section === "profile" ? "Kelola profil perusahaan dan dokumen legalitas." : section === "rfq" ? "Lihat RFQ yang ditujukan kepada perusahaan dan kirim penawaran." : "Tanggapi putaran negosiasi dari tim pengadaan."}
      />
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}
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
                        <div className="rounded-lg border border-border/70 p-3 text-sm">
                          <p className="font-medium">Dokumen lainnya</p>
                          {profile.vendor.vendorDocuments
                            .filter((doc) => !DOCUMENT_TYPES.includes(doc.jenis as (typeof DOCUMENT_TYPES)[number]))
                            .map((doc) => (
                              <div key={doc.id} className="mt-1 flex justify-between gap-2 text-muted-foreground">
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
              <div>{/* <p className="text-sm text-muted-foreground">Hanya RFQ yang diterbitkan untuk perusahaan Anda yang tampil.</p> */}</div>
              {rfqs.length === 0 ? (
                <EmptyData className="min-h-48 border-border/70 bg-card/70 shadow-sm" label="Belum ada RFQ aktif untuk vendor ini." />
              ) : (
                rfqs.map((rfq) => (
                  <article key={rfq.id} className="space-y-4 rounded-xl border border-border/70 bg-card p-5 shadow-sm">
                    <div>
                      <h3 className="font-semibold">{rfq.pengadaan.judul}</h3>
                      <p className="text-sm text-muted-foreground">
                        {rfq.pengadaan.nomorSurat} · RFQ {rfq.nomor} · Batas respons: {rfq.batasRespons ? new Date(rfq.batasRespons).toLocaleString("id-ID") : "Tidak ditentukan"}
                      </p>
                    </div>
                    <form onSubmit={(e) => void submitQuote(e, rfq)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="space-y-1 text-sm">
                        Harga penawaran
                        <input name="hargaPenawaran" type="number" min="0" step="0.0001" required className="w-full rounded-md border bg-background p-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        Mata uang
                        <select name="mataUang" className="w-full rounded-md border bg-background p-2">
                          <option>USD</option>
                          <option>IDR</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-sm">
                        Berlaku sampai
                        <input name="berlakuSampai" type="date" className="w-full rounded-md border bg-background p-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        Syarat pembayaran
                        <input name="syaratPembayaran" className="w-full rounded-md border bg-background p-2" />
                      </label>
                      <label className="space-y-1 text-sm">
                        Ketentuan pengangkutan
                        <input name="ketentuanPengangkutan" className="w-full rounded-md border bg-background p-2" />
                      </label>
                      <Button type="submit" disabled={busy} className="self-end">
                        Kirim penawaran
                      </Button>
                    </form>
                  </article>
                ))
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
