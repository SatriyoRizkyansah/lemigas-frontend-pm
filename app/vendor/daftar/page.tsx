"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API = process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001";

export default function VendorRegistrationPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("passwordConfirmation") ?? "")) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/public/vendor-registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaPerusahaan: String(form.get("namaPerusahaan") ?? "").trim(),
          namaPengguna: String(form.get("namaPengguna") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          password,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(", ") : (payload.message ?? "Pendaftaran gagal."));
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pendaftaran gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-slate-950">
            <Logo size={44} />
            <span>
              <strong className="block tracking-wide">LEMIGAS</strong>
              <span className="text-xs text-slate-500">Portal Pengadaan Publik</span>
            </span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
            Masuk
          </Link>
        </header>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_30rem] lg:items-start">
          <section className="rounded-3xl bg-slate-950 p-7 text-white sm:p-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide">
              <Building2 size={15} /> PENDAFTARAN PENYEDIA
            </span>
            <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">Mulai menjadi penyedia LEMIGAS</h1>
            <p className="mt-4 max-w-xl leading-7 text-slate-300">Buat akun perusahaan. Lengkapi profil dan dokumen legalitas setelah masuk. Tim LEMIGAS memverifikasi pengajuan sebelum akses penawaran dibuka.</p>
            <ol className="mt-8 space-y-4 text-sm text-slate-200">
              {["Buat akun perusahaan", "Lengkapi profil dan legalitas", "Ajukan verifikasi", "Ikuti RFQ publik setelah disetujui"].map((item, index) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-full bg-amber-300 font-bold text-slate-950">{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </section>
          <Card className="border-slate-200 shadow-xl shadow-slate-950/5">
            <CardContent className="p-6 sm:p-8">
              {done ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
                  <h2 className="mt-4 text-xl font-bold">Akun berhasil dibuat</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Masuk untuk melengkapi data perusahaan, unggah legalitas, lalu ajukan verifikasi.</p>
                  <Button className="mt-6" asChild>
                    <Link href="/login">Masuk ke portal vendor</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-bold">Daftar vendor</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Data ini dipakai untuk akun penanggung jawab vendor.</p>
                  <form onSubmit={submit} className="mt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="namaPerusahaan">Nama perusahaan</Label>
                      <Input id="namaPerusahaan" name="namaPerusahaan" required placeholder="PT Contoh Energi Indonesia" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="namaPengguna">Nama penanggung jawab</Label>
                      <Input id="namaPengguna" name="namaPengguna" required placeholder="Nama lengkap" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email akun</Label>
                      <Input id="email" name="email" type="email" autoComplete="email" required placeholder="vendor@perusahaan.co.id" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Kata sandi</Label>
                      <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="passwordConfirmation">Konfirmasi kata sandi</Label>
                      <Input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required />
                    </div>
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy ? (
                        <>
                          <Loader2 className="spin" /> Memproses
                        </>
                      ) : (
                        "Buat akun vendor"
                      )}
                    </Button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
