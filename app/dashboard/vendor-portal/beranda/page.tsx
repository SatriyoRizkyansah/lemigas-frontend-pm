"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, CircleHelp, FileText, Handshake, ShieldCheck, Store } from "lucide-react";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";

const API = process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001";
const stages = [
  {
    title: "Lengkapi profil perusahaan",
    short: "Profil",
    icon: Store,
    status: "draft",
    detail: "Pastikan nama perusahaan, alamat, email aktif, nomor telepon, NPWP, dan kontak penanggung jawab sesuai dokumen resmi. Data ini dipakai tim pengadaan untuk mengenali dan menghubungi perusahaan Anda.",
    action: "Buka Profil & Dokumen",
    href: "/dashboard/vendor-portal",
  },
  {
    title: "Unggah dokumen legalitas",
    short: "Dokumen",
    icon: FileText,
    status: "draft",
    detail:
      "Unggah dokumen yang diminta pada jenis yang sesuai. Periksa keterbacaan, masa berlaku, konsistensi nama perusahaan, dan pastikan berkas tidak melebihi batas ukuran. Jika ada revisi atau penolakan, ganti dokumen yang diminta lalu ajukan kembali.",
    action: "Kelola dokumen",
    href: "/dashboard/vendor-portal",
  },
  {
    title: "Ajukan verifikasi",
    short: "Verifikasi",
    icon: ShieldCheck,
    status: "submitted",
    detail:
      "Setelah profil dan dokumen siap, kirim pengajuan verifikasi. Tim LEMIGAS meninjau data. Selama status menunggu, pantau catatan reviewer. Status revisi atau ditolak berarti ada hal yang perlu diperbaiki sebelum pengajuan dikirim ulang.",
    action: "Lihat status verifikasi",
    href: "/dashboard/vendor-portal",
  },
  {
    title: "Tinjau RFQ dan kirim penawaran",
    short: "RFQ & Penawaran",
    icon: FileText,
    status: "approved",
    detail:
      "Setelah vendor disetujui, RFQ yang ditujukan kepada perusahaan tampil di portal. Baca ruang lingkup, tenggat, dan ketentuan. Isi harga, mata uang, masa berlaku, syarat pembayaran, serta ketentuan pengangkutan dengan cermat sebelum mengirim penawaran.",
    action: "Buka RFQ & Penawaran",
    href: "/dashboard/vendor-portal?section=rfq",
  },
  {
    title: "Tanggapi negosiasi",
    short: "Negosiasi",
    icon: Handshake,
    status: "approved",
    detail:
      "Tim pengadaan dapat membuka putaran negosiasi atas penawaran yang lulus evaluasi. Bandingkan harga penawaran awal dengan harga hasil negosiasi, lalu tinjau catatan dan total biaya. Berikan tanggapan terima atau tolak sesuai kewenangan perusahaan.",
    action: "Buka Negosiasi",
    href: "/dashboard/vendor-portal?section=negotiation",
  },
];
const statusLabel: Record<string, string> = { draft: "Belum diajukan", submitted: "Menunggu verifikasi", requires_revision: "Perlu revisi", rejected: "Ditolak — perlu perbaikan", approved: "Disetujui" };

export default function VendorBerandaPage() {
  const router = useRouter();
  const [vendorStatus, setVendorStatus] = useState("draft");
  const [expanded, setExpanded] = useState(0);
  const [checklist, setChecklist] = useState<boolean[]>([false, false, false, false]);

  useEffect(() => {
    const raw = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    const token = readSession(raw)?.token;
    fetch(`${API}/api/vendor-onboarding/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result?.data?.status) setVendorStatus(result.data.status);
      })
      .catch(() => undefined);
  }, []);

  const approved = vendorStatus === "approved";
  const activeIndex = approved ? 3 : vendorStatus === "submitted" ? 2 : 0;
  const doneCount = checklist.filter(Boolean).length;
  const toggle = (index: number) => setChecklist((current) => current.map((checked, i) => (i === index ? !checked : checked)));

  return (
    <main className="space-y-6">
      <PageHeader title="Beranda Vendor" description="Panduan perjalanan vendor: dari pendaftaran hingga penawaran dan negosiasi." />
      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="bg-primary px-5 py-6 text-primary-foreground sm:px-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">Portal Vendor LEMIGAS</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Kenali alur pengadaan, siapkan langkah berikutnya.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 opacity-90">Selesaikan verifikasi perusahaan terlebih dahulu. Setelah disetujui, Anda dapat mengikuti RFQ, mengirim penawaran, dan merespons negosiasi dari tim pengadaan.</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-sm">
              Status vendor: <strong>{statusLabel[vendorStatus] ?? vendorStatus}</strong>
            </span>
            <button
              type="button"
              onClick={() => router.push(approved ? "/dashboard/vendor-portal?section=rfq" : "/dashboard/vendor-portal")}
              className="inline-flex items-center gap-2 rounded-md bg-background px-4 py-2 text-sm font-semibold text-foreground hover:opacity-90"
            >
              {approved ? "Lihat RFQ" : "Lanjutkan verifikasi"}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5 sm:p-6">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const done = approved ? index < 3 : vendorStatus === "submitted" ? index < 2 : false;
            const current = index === activeIndex;
            return (
              <button
                key={stage.short}
                type="button"
                onClick={() => setExpanded(index)}
                className={`relative rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${expanded === index ? "border-primary ring-2 ring-primary/20" : "border-border/70"}`}
                aria-pressed={expanded === index}
              >
                <span className={`mb-3 flex size-9 items-center justify-center rounded-lg ${done ? "bg-emerald-500/10 text-emerald-700" : current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {done ? <Check size={18} /> : <Icon size={18} />}
                </span>
                <span className="block text-sm font-semibold">
                  {index + 1}. {stage.short}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{done ? "Selesai" : current ? "Langkah berikutnya" : "Tahap alur"}</span>
              </button>
            );
          })}
        </div>
        <article className="border-t border-border/70 bg-muted/20 p-5 sm:p-6" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Tahap {expanded + 1} · {stages[expanded].short}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{stages[expanded].title}</h3>
            </div>
            <Link href={stages[expanded].href} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent">
              {stages[expanded].action}
              <ArrowRight size={15} />
            </Link>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-muted-foreground">{stages[expanded].detail}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={expanded === 0} onClick={() => setExpanded((i) => Math.max(0, i - 1))} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40">
              Sebelumnya
            </button>
            <button type="button" disabled={expanded === stages.length - 1} onClick={() => setExpanded((i) => Math.min(stages.length - 1, i + 1))} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40">
              Berikutnya
            </button>
          </div>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Checklist kesiapan vendor</h2>
              <p className="mt-1 text-sm text-muted-foreground">Centang sebagai pengingat kerja. Checklist tersimpan selama halaman terbuka.</p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{doneCount}/4</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${doneCount * 25}%` }} />
          </div>
          <ul className="mt-4 space-y-2">
            {["Data perusahaan dan kontak sudah benar", "Dokumen legalitas terbaca dan masih berlaku", "Pengajuan verifikasi sudah dikirim atau status sudah disetujui", "Penawaran dan respons negosiasi diperiksa sebelum dikirim"].map(
              (label, index) => (
                <li key={label}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 p-3 text-sm">
                    <input type="checkbox" checked={checklist[index]} onChange={() => toggle(index)} className="mt-0.5 accent-primary" />
                    <span className={checklist[index] ? "text-muted-foreground line-through" : ""}>{label}</span>
                  </label>
                </li>
              ),
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <CircleHelp size={19} className="text-primary" />
            <h2 className="text-lg font-semibold">Panduan singkat</h2>
          </div>
          <div className="mt-4 space-y-2">
            {[
              ["Profil perusahaan", "Gunakan identitas resmi perusahaan dan kontak yang aktif."],
              ["Dokumen", "Unggah file sesuai kategori. Periksa status dokumen dan catatan reviewer."],
              ["RFQ & penawaran", "Hanya RFQ yang ditujukan kepada vendor Anda yang muncul. Perhatikan tenggat respons."],
              ["Negosiasi", "Tinjau rincian putaran dan berikan tanggapan yang sudah disepakati internal."],
            ].map(([title, body]) => (
              <details key={title} className="group rounded-lg border border-border/70">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-medium">
                  {title}
                  <ChevronDown size={16} className="transition group-open:rotate-180" />
                </summary>
                <p className="border-t border-border/60 px-3 py-3 text-sm leading-5 text-muted-foreground">{body}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
      <p className="text-center text-xs text-muted-foreground">Tips: periksa portal secara berkala untuk mengetahui perubahan status verifikasi, RFQ baru, tenggat, dan permintaan tanggapan.</p>
    </main>
  );
}
