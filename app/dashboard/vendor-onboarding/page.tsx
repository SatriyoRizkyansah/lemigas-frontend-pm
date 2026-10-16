"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileText, RefreshCw, XCircle } from "lucide-react";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { LoadingState } from "@/components/loading/LoadingState";
import { EmptyData } from "@/components/loading/EmptyData";

type Onboarding = {
  id: string;
  status: string;
  submittedAt?: string | null;
  rejectionReason?: string | null;
  vendor: {
    id: string;
    nama: string;
    email?: string | null;
    npwp?: string | null;
    alamat?: string | null;
    telepon?: string | null;
    contactPerson?: string | null;
    vendorAccounts: { id: string; nama: string; email: string }[];
    vendorDocuments: { id: string; jenis: string; filePath: string; status: string; expiresAt?: string | null }[];
  };
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
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
  return body;
}

export default function VendorOnboardingPage() {
  const [status, setStatus] = useState("submitted");
  const [items, setItems] = useState<Onboarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request<{ data: Onboarding[] }>(`/api/vendor-onboarding?status=${encodeURIComponent(status)}`);
      setItems(result.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat onboarding");
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function review(item: Onboarding, decision: "approved" | "rejected" | "requires_revision") {
    setBusy(item.id);
    setError("");
    try {
      await request(`/api/vendor-onboarding/${item.id}/review`, {
        method: "PUT",
        body: JSON.stringify({ status: decision, rejectionReason: notes[item.id] || undefined, revision: decision === "requires_revision" ? { catatan: notes[item.id] || "Mohon perbaiki data/dokumen" } : undefined }),
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review gagal disimpan");
    } finally {
      setBusy("");
    }
  }

  async function openDocument(id: string) {
    try {
      const response = await fetch(`${API}/api/vendor-onboarding/documents/${id}/file`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!response.ok) throw new Error("File tidak bisa dibuka");
      const url = URL.createObjectURL(await response.blob());
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "File tidak bisa dibuka");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Verifikasi mitra</p>
          <h1 className="mt-1 text-3xl font-bold">Onboarding Vendor</h1>
          <p className="mt-2 text-muted-foreground">Review profil perusahaan dan dokumen legalitas sebelum vendor mengikuti sourcing.</p>
        </div>
        <div className="flex gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border bg-background px-3 py-2">
            <option value="submitted">Menunggu review</option>
            <option value="in_review">Dalam review</option>
            <option value="requires_revision">Perlu revisi</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
          <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
            <RefreshCw size={16} /> Muat ulang
          </button>
        </div>
      </header>
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading..." />
      ) : items.length === 0 ? (
        <EmptyData label="Tidak ada onboarding dengan status ini." />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{item.vendor.nama}</h2>
                  <p className="text-sm text-muted-foreground">
                    Diajukan {item.submittedAt ? new Date(item.submittedAt).toLocaleString("id-ID") : "—"} · Status: {item.status}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-sm">{item.vendor.vendorAccounts.length} akun pengguna</span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">NPWP</dt>
                  <dd>{item.vendor.npwp || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>{item.vendor.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Telepon</dt>
                  <dd>{item.vendor.telepon || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Kontak</dt>
                  <dd>{item.vendor.contactPerson || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Alamat</dt>
                  <dd>{item.vendor.alamat || "—"}</dd>
                </div>
              </dl>
              <div className="mt-4">
                <h3 className="font-medium">Dokumen</h3>
                {item.vendor.vendorDocuments.length ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {item.vendor.vendorDocuments.map((doc) => (
                      <li key={doc.id}>
                        <button onClick={() => void openDocument(doc.id)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                          <FileText size={16} />
                          {doc.jenis} · {doc.status}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">Belum ada dokumen.</p>
                )}
              </div>
              {["submitted", "in_review"].includes(item.status) && (
                <div className="mt-5 border-t pt-4">
                  <label className="block text-sm font-medium" htmlFor={`note-${item.id}`}>
                    Catatan review / alasan
                  </label>
                  <textarea
                    id={`note-${item.id}`}
                    value={notes[item.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    rows={2}
                    className="mt-1 w-full rounded-md border bg-background p-2"
                    placeholder="Isi jika perlu revisi atau penolakan"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={Boolean(busy)} onClick={() => void review(item, "approved")} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">
                      <CheckCircle2 size={16} />
                      {busy === item.id ? "Menyimpan…" : "Setujui"}
                    </button>
                    <button disabled={Boolean(busy)} onClick={() => void review(item, "requires_revision")} className="rounded-md border px-4 py-2 disabled:opacity-50">
                      Minta revisi
                    </button>
                    <button disabled={Boolean(busy)} onClick={() => void review(item, "rejected")} className="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-destructive disabled:opacity-50">
                      <XCircle size={16} />
                      Tolak
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
