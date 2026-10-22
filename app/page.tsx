"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarDays, FileText, Search, ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/Button";

const API = process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001";
type Rfq = { id: string; nomor: string; batasRespons?: string | null; pengadaan: { nomorSurat: string; judul: string } };
const deadline = (value?: string | null) => (value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Belum ditentukan");

export default function Home() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/api/public/rfqs`)
      .then((r) => r.json())
      .then((result) => setRfqs(result.data ?? []))
      .catch(() => setRfqs([]))
      .finally(() => setLoading(false));
  }, []);
  const rows = useMemo(() => rfqs.filter((rfq) => `${rfq.nomor} ${rfq.pengadaan.nomorSurat} ${rfq.pengadaan.judul}`.toLowerCase().includes(query.toLowerCase())), [query, rfqs]);
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={42} />
            <span>
              <strong className="block tracking-wide">LEMIGAS</strong>
              <span className="text-xs text-slate-500">Portal Pengadaan Publik</span>
            </span>
          </Link>
          <div className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
            <a href="#rfq">RFQ Publik</a>
            <Link href="/vendor/daftar">Pendaftaran Penyedia</Link>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/login">Masuk</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/vendor/daftar">Daftar Vendor</Link>
            </Button>
          </div>
        </nav>
      </header>
      <section className="bg-slate-950 px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.3fr_.7fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold tracking-wide text-amber-200">
              <ShieldCheck size={15} /> PENGADAAN TERBUKA
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Temukan RFQ LEMIGAS. Kirim penawaran secara transparan.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Pembelian Langsung dipublikasikan untuk vendor terverifikasi. Daftar, lengkapi legalitas, lalu ikuti RFQ aktif.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button className="bg-amber-300 text-slate-950 hover:bg-amber-200" asChild>
                <a href="#rfq">
                  Cari RFQ <ArrowRight />
                </a>
              </Button>
              <Button variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/vendor/daftar">Menjadi vendor</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">Akses vendor</p>
            <p className="text-3xl font-bold">{loading ? "…" : rfqs.length}</p>
            <p className="text-sm text-slate-400">RFQ publik aktif saat ini</p>
            <div className="mt-3 border-t border-white/10 pt-4 text-sm text-slate-300">Penawaran hanya untuk vendor dengan onboarding disetujui.</div>
          </div>
        </div>
      </section>
      <section id="rfq" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-[.15em] text-amber-700">RFQ PUBLIK</p>
            <h2 className="mt-2 text-3xl font-bold">Daftar paket aktif</h2>
            <p className="mt-2 text-sm text-slate-600">Informasi publik. Rincian penawaran dan evaluasi tetap rahasia.</p>
          </div>
          <label className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-slate-500 sm:w-80">
            <Search size={18} />
            <span className="sr-only">Cari RFQ</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nomor atau nama paket" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
          </label>
        </div>
        <div className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Paket / RFQ</th>
                  <th className="px-5 py-4">Metode</th>
                  <th className="px-5 py-4">Batas penawaran</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      Memuat RFQ publik…
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((rfq) => (
                    <tr key={rfq.id} className="align-top hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-950">{rfq.pengadaan.judul}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {rfq.nomor} · {rfq.pengadaan.nomorSurat}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">Pembelian Langsung</td>
                      <td className="px-5 py-4 text-slate-600">{deadline(rfq.batasRespons)}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Kirim Penawaran</span>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/rfq/${rfq.id}`} className="whitespace-nowrap font-semibold text-slate-950 hover:underline">
                          Lihat paket
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                      Belum ada RFQ publik aktif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-12 sm:grid-cols-3 sm:px-8">
          {[
            [Building2, "Daftar perusahaan", "Buat akun penanggung jawab vendor."],
            [FileText, "Lengkapi legalitas", "Unggah profil dan dokumen perusahaan."],
            [CalendarDays, "Kirim penawaran", "Akses RFQ setelah verifikasi disetujui."],
          ].map(([Icon, title, text]) => {
            const I = Icon as typeof Building2;
            return (
              <article key={title as string} className="rounded-xl border border-slate-200 p-5">
                <I className="text-amber-600" />
                <h3 className="mt-4 font-bold">{title as string}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{text as string}</p>
              </article>
            );
          })}
        </div>
      </section>
      <footer className="bg-slate-950 px-5 py-8 text-sm text-slate-400 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3">
          <span>© {new Date().getFullYear()} LEMIGAS</span>
          <span>Portal Pengadaan Publik</span>
        </div>
      </footer>
    </main>
  );
}
