"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

type Profile = { id: string; nama: string; email: string; unitKerja?: string | null; role: { kode: string; nama: string } };
const API = process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001";
function sessionToken() {
  const raw = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return readSession(raw)?.token;
}
async function request<T>(method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}/api/user/me`, { method, headers: { Authorization: `Bearer ${sessionToken()}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(result.message) ? result.message.join(", ") : (result.message ?? `Request gagal (${response.status})`));
  return result.data;
}

export default function ProfilPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setError("");
      setProfile(await request<Profile>("GET"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profil gagal dimuat");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(form.entries());
    const payload: Record<string, string> = { nama: String(values.nama ?? ""), email: String(values.email ?? ""), unitKerja: String(values.unitKerja ?? "") };
    if (values.password) {
      payload.password = String(values.password);
      payload.currentPassword = String(values.currentPassword ?? "");
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setProfile(await request<Profile>("PUT", payload));
      setNotice("Profil berhasil disimpan.");
      event.currentTarget.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profil gagal disimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 py-1">
      <PageHeader title="Profil" description="Ubah informasi akun pribadi. Peran akun dikelola administrator." />
      {!profile && !error && (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Memuat profil…</CardContent>
        </Card>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {profile && (
        <>
          <Card>
            <CardContent className="flex items-center gap-4 py-5">
              <Avatar className="size-14">
                <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">
                  {profile.nama
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{profile.nama}</p>
                <p className="text-sm text-muted-foreground">{profile.role.nama}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 sm:p-7">
              <form onSubmit={save} className="w-full space-y-6">
                <div className="border-b pb-4">
                  <h2 className="text-lg font-semibold">Data diri</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Perubahan hanya berlaku untuk akun Anda.</p>
                </div>
                <div className="grid w-full gap-x-6 gap-y-4 sm:grid-cols-2">
                  <label className="block min-w-0 space-y-1.5 text-sm font-medium">
                    Nama lengkap
                    <input
                      name="nama"
                      required
                      maxLength={150}
                      defaultValue={profile.nama}
                      className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="block min-w-0 space-y-1.5 text-sm font-medium">
                    Email
                    <input
                      name="email"
                      type="email"
                      required
                      maxLength={150}
                      defaultValue={profile.email}
                      className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                  <label className="block min-w-0 space-y-1.5 text-sm font-medium sm:col-span-2">
                    Unit kerja
                    <input
                      name="unitKerja"
                      maxLength={150}
                      defaultValue={profile.unitKerja ?? ""}
                      className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>
                </div>
                <fieldset className="w-full space-y-4 rounded-lg border bg-muted/20 p-4 sm:p-5">
                  <legend className="px-1 text-sm font-semibold">
                    Ganti password <span className="font-normal text-muted-foreground">(opsional)</span>
                  </legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block min-w-0 space-y-1.5 text-sm font-medium">
                      Password saat ini
                      <input
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <label className="block min-w-0 space-y-1.5 text-sm font-medium">
                      Password baru
                      <input
                        name="password"
                        type="password"
                        minLength={6}
                        autoComplete="new-password"
                        className="block h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="block text-xs font-normal text-muted-foreground">Minimal 6 karakter.</span>
                    </label>
                  </div>
                </fieldset>
                <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t pt-5">
                  {notice && (
                    <p role="status" className="text-sm text-emerald-700">
                      {notice}
                    </p>
                  )}
                  {error && (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Menyimpan…" : "Simpan perubahan"}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
