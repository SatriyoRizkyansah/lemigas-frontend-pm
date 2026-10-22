"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, FileText } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/Button";

const API = process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001";
type Rfq = {
  id: string;
  nomor: string;
  batasRespons?: string | null;
  volume?: number | string | null;
  satuan?: string | null;
  titikSerah?: string | null;
  syaratPembayaran?: string | null;
  syaratPenyerahan?: string | null;
  spesifikasi?: Record<string, unknown> | null;
  dokumenDiminta?: Array<{ id: string; nama: string; wajib?: boolean; keterangan?: string }> | null;
  ketentuan?: Record<string, unknown> | null;
  pengadaan: { nomorSurat: string; judul: string; deskripsi?: string | null; prioritas?: string | null };
};

const TERM_LABELS: Record<string, string> = {
  volume: "Volume",
  satuan: "Satuan",
  titikSerah: "Titik serah",
  spesifikasi: "Spesifikasi kebutuhan",
  dokumenDiminta: "Dokumen yang diminta",
  syaratPembayaran: "Syarat pembayaran",
  syaratPenyerahan: "Syarat penyerahan",
};
function labelForTerm(key: string) {
  return TERM_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase());
}
function normalizeTerm(key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value) && key in value) return (value as Record<string, unknown>)[key];
  return value;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function asText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(asText).join(", ");
  if (isRecord(value)) return Object.values(value).map(asText).join(", ");
  return String(value);
}

export default function PublicRfqDetail({ params }: { params: { rfqId: string } }) {
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`${API}/api/public/rfqs/${params.rfqId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "RFQ tidak ditemukan");
        return data;
      })
      .then((r) => setRfq(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : "RFQ tidak ditemukan"));
  }, [params.rfqId]);
  if (error)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">RFQ tidak tersedia</h1>
          <p className="mt-2 text-slate-600">{error}</p>
          <Button className="mt-5" asChild>
            <Link href="/">Kembali ke RFQ publik</Link>
          </Button>
        </div>
      </main>
    );
  if (!rfq) return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Memuat RFQ…</main>;
  const canonicalTerms: Array<[string, unknown]> = [
    ["volume", rfq.volume],
    ["satuan", rfq.satuan],
    ["titikSerah", rfq.titikSerah],
    ["syaratPembayaran", rfq.syaratPembayaran],
    ["syaratPenyerahan", rfq.syaratPenyerahan],
    ["spesifikasi", rfq.spesifikasi],
    ["dokumenDiminta", rfq.dokumenDiminta],
  ];
  const terms = canonicalTerms.some(([, value]) => value !== null && value !== undefined && value !== "")
    ? canonicalTerms.filter(([, value]) => value !== null && value !== undefined && value !== "")
    : Object.entries(rfq.ketentuan ?? {})
        .map(([key, value]) => [key, normalizeTerm(key, value)] as const)
        .filter(([, value]) => value !== null && value !== undefined && value !== "");
  const basicTerms = terms.filter(([, value]) => !isRecord(value) && !Array.isArray(value));
  const structuredTerms = terms.filter(([, value]) => isRecord(value) || Array.isArray(value));
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={38} />
            <strong>LEMIGAS</strong>
          </Link>
          <Button size="sm" asChild>
            <Link href="/login">Masuk vendor</Link>
          </Button>
        </div>
      </header>
      <article className="mx-auto max-w-5xl px-5 py-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950">
          <ArrowLeft size={16} /> Semua RFQ
        </Link>
        <div className="mt-6 rounded-2xl bg-slate-950 p-7 text-white sm:p-9">
          <p className="text-sm text-amber-200">PEMBELIAN LANGSUNG · {rfq.nomor}</p>
          <h1 className="mt-3 text-3xl font-bold">{rfq.pengadaan.judul}</h1>
          <p className="mt-3 text-slate-300">Nomor pengadaan: {rfq.pengadaan.nomorSurat}</p>
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-200">
            <CalendarDays size={17} />
            {rfq.batasRespons ? `Batas penawaran: ${new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeStyle: "short" }).format(new Date(rfq.batasRespons))}` : "Batas penawaran belum ditentukan"}
          </div>
        </div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_18rem]">
          <section className="rounded-xl border bg-white p-6">
            <h2 className="text-xl font-bold">Informasi paket</h2>
            <p className="mt-4 whitespace-pre-line leading-7 text-slate-700">{rfq.pengadaan.deskripsi || "Rincian kebutuhan tersedia pada ketentuan RFQ."}</p>
            <h2 className="mt-8 flex items-center gap-2 text-xl font-bold">
              <FileText size={20} /> Ketentuan RFQ
            </h2>
            {terms.length ? (
              <div className="mt-4 space-y-4">
                {basicTerms.length ? (
                  <dl className="grid gap-3 sm:grid-cols-2">
                    {basicTerms.map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labelForTerm(key)}</dt>
                        <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-800">{asText(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {structuredTerms.map(([key, value]) => {
                  const rows = Array.isArray(value) ? value.map((item, index) => [String(index + 1), item] as const) : Object.entries(isRecord(value) ? value : {});
                  return (
                    <section key={key} className="overflow-hidden rounded-lg border border-slate-200">
                      <h3 className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">{labelForTerm(key)}</h3>
                      <dl className="divide-y">
                        {rows.map(([name, item], index) => (
                          <div key={`${name}-${index}`} className="grid gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
                            <dt className="font-medium text-slate-700">{name}</dt>
                            <dd className="whitespace-pre-wrap text-slate-700 sm:col-span-2">{asText(item)}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-slate-600">Ketentuan belum dipublikasikan.</p>
            )}
          </section>
          <aside className="h-fit rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="font-bold">Ingin mengirim penawaran?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">Masuk sebagai vendor terverifikasi. Pendaftaran tidak langsung memberi akses penawaran.</p>
            <Button className="mt-5 w-full" asChild>
              <Link href="/login">Masuk vendor</Link>
            </Button>
            <Button className="mt-2 w-full" variant="outline" asChild>
              <Link href="/vendor/daftar">Daftar vendor</Link>
            </Button>
          </aside>
        </div>
      </article>
    </main>
  );
}
