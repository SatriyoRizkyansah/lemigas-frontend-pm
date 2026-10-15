"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FileUp, RefreshCw, Send } from "lucide-react";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

type VendorDoc = { id: string; jenis: string; status: string; filePath: string; expiresAt?: string | null };
type Portal = {
  id: string;
  status: string;
  rejectionReason?: string | null;
  revision?: unknown;
  vendor: { id: string; nama: string; alamat?: string | null; telepon?: string | null; email?: string | null; npwp?: string | null; contactPerson?: string | null; vendorDocuments: VendorDoc[] };
};
type Rfq = { id: string; nomor: string; batasRespons?: string | null; pengadaan: { id: string; nomorSurat: string; judul: string; status: string } };
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

export default function VendorPortalPage() {
  const [profile, setProfile] = useState<Portal | null>(null);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [jenis, setJenis] = useState("NIB");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setError("");
    try {
      const result = await request<{ data: Portal }>("/api/vendor-onboarding/me");
      setProfile(result.data);
      if (result.data.status === "approved") {
        const list = await request<{ data: Rfq[] }>("/api/vendor-onboarding/me/rfqs");
        setRfqs(list.data ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat portal");
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
      await request("/api/vendor-onboarding/me/profile", { method: "PUT", body: JSON.stringify(values) });
      setNotice("Profil tersimpan.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profil gagal disimpan");
    } finally {
      setBusy(false);
    }
  }
  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Pilih file PDF, JPG, atau PNG.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData();
    form.append("file", file);
    form.append("jenis", jenis);
    try {
      await request("/api/vendor-onboarding/me/documents", { method: "POST", body: form });
      setFile(null);
      event.currentTarget.reset();
      setNotice("Dokumen berhasil diunggah.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dokumen gagal diunggah");
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
      setNotice(result.message || "Onboarding dikirim untuk review.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pengajuan gagal");
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
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Area mitra</p>
          <h1 className="mt-1 text-3xl font-bold">Portal Vendor</h1>
          <p className="mt-2 text-muted-foreground">Kelola profil, dokumen legalitas, dan tanggapi RFQ perusahaan Anda.</p>
        </div>
        <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
          <RefreshCw size={16} /> Muat ulang
        </button>
      </header>
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
      {!profile ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Memuat status onboarding…</div>
      ) : (
        <>
          <article className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{profile.vendor.nama}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Status verifikasi: <strong className="capitalize text-foreground">{profile.status.replaceAll("_", " ")}</strong>
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-sm">{profile.status === "approved" ? "Akses sourcing aktif" : "Akses penawaran terkunci"}</span>
            </div>
            {profile.rejectionReason && <p className="mt-3 text-sm text-destructive">Catatan reviewer: {profile.rejectionReason}</p>}
          </article>
          {["draft", "requires_revision"].includes(profile.status) && (
            <>
              <form onSubmit={saveProfile} className="space-y-4 rounded-xl border bg-card p-5">
                <h2 className="text-lg font-semibold">Profil perusahaan</h2>
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
                <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
                  Simpan profil
                </button>
              </form>
              <form onSubmit={uploadDocument} className="space-y-4 rounded-xl border bg-card p-5">
                <h2 className="text-lg font-semibold">Dokumen legalitas</h2>
                <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
                  <label className="space-y-1 text-sm">
                    Jenis dokumen
                    <select value={jenis} onChange={(e) => setJenis(e.target.value)} className="w-full rounded-md border bg-background p-2">
                      <option>NIB</option>
                      <option>NPWP</option>
                      <option>Akta Perusahaan</option>
                      <option>Surat Domisili</option>
                      <option>Rekening Bank</option>
                      <option>Lainnya</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    File (PDF/JPG/PNG, maks. 10 MB)
                    <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-md border bg-background p-1.5" />
                  </label>
                  <button disabled={busy} className="self-end inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 disabled:opacity-50">
                    <FileUp size={16} /> Unggah
                  </button>
                </div>
                <ul className="space-y-2">
                  {profile.vendor.vendorDocuments.map((doc) => (
                    <li key={doc.id} className="flex justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                      <span>
                        {doc.jenis} · {doc.status}
                      </span>
                      <button type="button" onClick={() => void download(doc.id)} className="text-primary underline">
                        Unduh
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t pt-4">
                  <button
                    type="button"
                    disabled={busy || profile.vendor.vendorDocuments.length === 0}
                    onClick={() => void submitOnboarding()}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                  >
                    <Send size={16} /> Ajukan verifikasi
                  </button>
                </div>
              </form>
            </>
          )}
          {profile.status === "submitted" && (
            <div className="rounded-xl border bg-card p-5 text-sm">Data sudah dikirim. Tunggu Admin/Verifikator menyelesaikan review. Anda masih bisa melihat dokumen di portal setelah disetujui atau diminta revisi.</div>
          )}
          {profile.status === "approved" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold">RFQ tersedia</h2>
                <p className="text-sm text-muted-foreground">Hanya RFQ yang diterbitkan untuk perusahaan Anda yang tampil.</p>
              </div>
              {rfqs.length === 0 ? (
                <div className="rounded-xl border bg-card p-6 text-muted-foreground">Belum ada RFQ aktif untuk vendor ini.</div>
              ) : (
                rfqs.map((rfq) => (
                  <article key={rfq.id} className="space-y-4 rounded-xl border bg-card p-5">
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
                      <button disabled={busy} className="self-end rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
                        Kirim penawaran
                      </button>
                    </form>
                  </article>
                ))
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
