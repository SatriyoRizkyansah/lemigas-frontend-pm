"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import Skyline from "@/components/Skyline";
import { setSession } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useLoginMutation } from "@/lib/api/hooks";

export default function LoginPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const loginMutation = useLoginMutation();
  const loading = loginMutation.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!identity.trim() || !password) {
      setError("Isi email dan kata sandi Anda.");
      return;
    }

    try {
      const response = await loginMutation.mutateAsync({ data: { email: identity.trim(), password } });
      const access = response.akses?.[0];
      if (!access?.token) throw new Error("Respons login tidak memuat token akses.");
      setSession(access.token, { name: response.nama, email: identity.trim(), role: access.akses }, remember);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }

  return (
    <main className="login">
      <div className="login-bg" aria-hidden="true">
        <Skyline className="login-skyline" />
      </div>

      <header className="login-brand">
        <Logo size={72} className="login-brand-logo" />
        <div className="login-brand-name">
          <strong>LEMIGAS</strong>
          <span>Lembaga Minyak dan Gas Bumi</span>
        </div>
        <p className="login-tagline">Transparansi Pengadaan, Energi untuk Indonesia</p>
      </header>

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-card-top">
          <Logo size={52} />
          <label className="lang">
            <span className="sr-only">Bahasa</span>
            <select defaultValue="id" aria-label="Bahasa">
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>

        <p className="login-product">LEMIGAS SUPER APPS</p>
        <h1 id="login-title">Masuk ke akun Anda</h1>

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label htmlFor="identity">Email atau username</label>
            <input id="identity" name="identity" type="text" autoComplete="username" placeholder="nama@lemigas.esdm.go.id" value={identity} onChange={(e) => setIdentity(e.target.value)} aria-invalid={Boolean(error) && !identity.trim()} />
          </div>

          <div className="field">
            <label htmlFor="password">Kata sandi</label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Masukkan kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error) && !password}
              />
              <button type="button" className="input-addon" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={show}>
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            <span>Ingat saya</span>
          </label>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-dark btn-block" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spin" /> Memproses…
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
