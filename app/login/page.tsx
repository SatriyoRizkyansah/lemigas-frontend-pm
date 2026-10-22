"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { browserApi } from "@/lib/api/browser-client";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import Skyline from "@/components/Skyline";
import { setSession } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useLoginMutation } from "@/lib/api/hooks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loginLock = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const loginMutation = useLoginMutation();
  const loading = submitting || loginMutation.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loginLock.current) return;
    setError("");

    if (!identity.trim() || !password) {
      setError("Isi email dan kata sandi Anda.");
      return;
    }

    loginLock.current = true;
    setSubmitting(true);
    try {
      const response = await loginMutation.mutateAsync({ data: { email: identity.trim(), password } });
      const access = response.akses?.[0];
      if (!access?.token) throw new Error("Respons login tidak memuat token akses.");
      await queryClient.cancelQueries();
      queryClient.clear();
      browserApi.setSecurityData(null);
      const roles = response.akses.map((item) => ({ token: item.token, label: item.akses, roleId: item.roleId, roleCode: item.kode }));
      setSession(access.token, { name: response.nama, email: identity.trim(), role: access.akses }, remember, roles);
      browserApi.setSecurityData(access.token);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
      loginLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-950 px-4 py-10">
      <Skyline className="pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full text-white/10" aria-hidden="true" />
      <div className="relative grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_26rem] lg:items-center">
        <header className="text-center text-white lg:text-left">
          <div className="flex items-center justify-center gap-4 lg:justify-start">
            <Logo size={72} className="shrink-0" />
            <div>
              <strong className="block text-3xl tracking-wide">LEMIGAS</strong>
              <span className="text-sm text-white/70">Lembaga Minyak dan Gas Bumi</span>
            </div>
          </div>
          <p className="mt-6 text-lg text-white/85">Transparansi Pengadaan, Energi untuk Indonesia</p>
        </header>
        <Card className="border-white/10 bg-background/95 shadow-2xl backdrop-blur" aria-labelledby="login-title">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <Logo size={52} />
              <label className="text-sm text-muted-foreground">
                <span className="sr-only">Bahasa</span>
                <select defaultValue="id" aria-label="Bahasa" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <p className="mt-7 text-xs font-semibold tracking-[0.16em] text-primary">LEMIGAS SUPER APPS</p>
            <h1 id="login-title" className="mt-2 text-2xl font-bold tracking-tight">
              Masuk ke akun Anda
            </h1>
            <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="identity">Email atau username</Label>
                <Input
                  id="identity"
                  name="identity"
                  type="text"
                  autoComplete="username"
                  placeholder="nama@lemigas.esdm.go.id"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  aria-invalid={Boolean(error) && !identity.trim()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata sandi</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Masukkan kata sandi"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(error) && !password}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    aria-pressed={show}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </div>
              </div>
              <Label className="w-fit cursor-pointer gap-2 font-normal">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 rounded border-input accent-primary" />
                <span>Ingat saya</span>
              </Label>
              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={18} className="spin" /> Memproses…
                  </>
                ) : (
                  "Masuk"
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Belum punya akun vendor?{" "}
                <a href="/vendor/daftar" className="font-semibold text-primary hover:underline">
                  Daftar sebagai vendor
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
