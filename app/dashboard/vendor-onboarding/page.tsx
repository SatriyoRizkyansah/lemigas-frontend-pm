"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Eye, XCircle } from "lucide-react";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { LoadingState } from "@/components/loading/LoadingState";
import { EmptyData } from "@/components/loading/EmptyData";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/table/DataTable";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
const STATUS_LABELS: Record<string, string> = {
  submitted: "Menunggu review",
  in_review: "Dalam review",
  requires_revision: "Perlu revisi",
  approved: "Disetujui",
  rejected: "Ditolak",
};

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
  const [selectedItem, setSelectedItem] = useState<Onboarding | null>(null);
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

  const columns = useMemo(
    () => [
      {
        key: "nama",
        header: "Nama Vendor",
        render: (item: Onboarding) => (
          <div>
            <p className="font-medium text-foreground">{item.vendor.nama}</p>
            <p className="text-xs text-muted-foreground">{item.vendor.email || item.vendor.npwp || "Kontak belum tersedia"}</p>
          </div>
        ),
      },
      {
        key: "submittedAt",
        header: "Tanggal Pengajuan",
        render: (item: Onboarding) => <span className="text-sm text-muted-foreground">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—"}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (item: Onboarding) => (
          <StatusBadge status={item.status === "approved" ? "ok" : item.status === "rejected" ? "danger" : item.status === "requires_revision" ? "warn" : "neutral"}>
            {STATUS_LABELS[item.status] ?? item.status.replaceAll("_", " ")}
          </StatusBadge>
        ),
      },
      { key: "documents", header: "Dokumen", render: (item: Onboarding) => <span className="text-sm text-muted-foreground">{item.vendor.vendorDocuments.length} dokumen</span> },
      {
        key: "actions",
        header: "Aksi",
        className: "w-28 text-right",
        render: (item: Onboarding) => (
          <Button type="button" variant="outline" size="sm" onClick={() => setSelectedItem(item)}>
            <Eye className="mr-2 size-4" />
            Detail
          </Button>
        ),
        filterable: false,
      },
    ],
    [],
  );

  async function review(item: Onboarding, decision: "approved" | "rejected" | "requires_revision") {
    setBusy(item.id);
    setError("");
    try {
      const result = await request<{ message?: string }>(`/api/vendor-onboarding/${item.id}/review`, {
        method: "PUT",
        body: JSON.stringify({ status: decision, rejectionReason: notes[item.id] || undefined, revision: decision === "requires_revision" ? { catatan: notes[item.id] || "Mohon perbaiki data/dokumen" } : undefined }),
      });
      const message = result.message || "Review onboarding berhasil disimpan.";
      setError("");
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
      setSelectedItem(null);
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Review gagal disimpan";
      setError(message);
      window.dispatchEvent(new CustomEvent("api:error", { detail: { message } }));
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
    <section className="space-y-5 py-1">
      <PageHeader title="Onboarding Vendor" description="Review profil perusahaan dan dokumen legalitas sebelum vendor mengikuti sourcing." />
      {error && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}
      {loading ? (
        <LoadingState label="Loading..." />
      ) : items.length === 0 ? (
        <EmptyData className="min-h-72 border-border/70 bg-card/70 shadow-sm" label={status === "submitted" ? "Belum ada vendor yang menunggu review." : `Belum ada onboarding berstatus ${status.replaceAll("_", " ")}.`} />
      ) : (
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(item) => item.id}
          pageSize={10}
          searchPlaceholder="Cari nama, email, NPWP..."
          emptyMessage="Belum ada vendor untuk status ini."
          filters={[{ field: "status", label: "Status onboarding", options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })) }]}
          filterValues={{ status }}
          onFilterChange={(field, value) => {
            if (field === "status" && value !== "__all") {
              setStatus(value);
              setSelectedItem(null);
            }
          }}
        />
      )}
      <Dialog
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      >
        {selectedItem && (
          <DialogContent className="flex max-h-[min(88dvh,780px)] max-w-3xl flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b px-6 py-5 pr-14">
              <DialogTitle className="text-lg">{selectedItem.vendor.nama}</DialogTitle>
              <DialogDescription>Profil perusahaan dan dokumen legalitas untuk review onboarding.</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={selectedItem.status === "approved" ? "ok" : selectedItem.status === "rejected" ? "danger" : selectedItem.status === "requires_revision" ? "warn" : "neutral"}>
                  {STATUS_LABELS[selectedItem.status] ?? selectedItem.status.replaceAll("_", " ")}
                </StatusBadge>
                <span className="text-sm text-muted-foreground">Diajukan {selectedItem.submittedAt ? new Date(selectedItem.submittedAt).toLocaleString("id-ID") : "—"}</span>
              </div>
              <dl className="grid gap-3 rounded-xl border bg-muted/20 p-4 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="mt-1 break-words font-medium">{selectedItem.vendor.email || "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">NPWP</dt>
                  <dd className="mt-1 break-words font-medium">{selectedItem.vendor.npwp || "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Telepon</dt>
                  <dd className="mt-1 break-words font-medium">{selectedItem.vendor.telepon || "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Kontak person</dt>
                  <dd className="mt-1 break-words font-medium">{selectedItem.vendor.contactPerson || "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Akun pengguna</dt>
                  <dd className="mt-1 font-medium">{selectedItem.vendor.vendorAccounts.length} akun</dd>
                </div>
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Alamat</dt>
                  <dd className="mt-1 break-words font-medium">{selectedItem.vendor.alamat || "—"}</dd>
                </div>
              </dl>
              <div>
                <h3 className="text-sm font-semibold">
                  Dokumen legalitas <span className="font-normal text-muted-foreground">({selectedItem.vendor.vendorDocuments.length})</span>
                </h3>
                {selectedItem.vendor.vendorDocuments.length ? (
                  <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-background">
                    {selectedItem.vendor.vendorDocuments.map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:flex-nowrap">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <FileText className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.jenis}</p>
                            <p className="text-xs text-muted-foreground">{doc.expiresAt ? `Berlaku hingga ${new Date(doc.expiresAt).toLocaleDateString("id-ID")}` : "Dokumen vendor"}</p>
                          </div>
                        </div>
                        <div className="ml-12 flex shrink-0 items-center gap-2 sm:ml-0">
                          <StatusBadge status={doc.status === "verified" || doc.status === "approved" ? "ok" : doc.status === "rejected" ? "danger" : doc.status === "draft" ? "neutral" : "warn"}>
                            {doc.status.replaceAll("_", " ")}
                          </StatusBadge>
                          <Button type="button" variant="outline" size="sm" onClick={() => void openDocument(doc.id)}>
                            Buka
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Belum ada dokumen.</p>
                )}
              </div>
              {["submitted", "in_review"].includes(selectedItem.status) && (
                <div className="rounded-xl border bg-background p-4">
                  <label className="text-sm font-semibold" htmlFor={`note-${selectedItem.id}`}>
                    Catatan review / alasan penolakan
                  </label>
                  <textarea
                    id={`note-${selectedItem.id}`}
                    value={notes[selectedItem.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [selectedItem.id]: e.target.value }))}
                    rows={3}
                    className="mt-2 w-full rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    placeholder="Wajib diisi jika pengajuan ditolak"
                  />
                </div>
              )}
            </div>
            {["submitted", "in_review"].includes(selectedItem.status) && (
              <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-6 py-4">
                <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => void review(selectedItem, "rejected")}>
                  <XCircle className="mr-2 size-4" />
                  Tolak
                </Button>
                <Button type="button" disabled={Boolean(busy)} onClick={() => void review(selectedItem, "approved")}>
                  <CheckCircle2 className="mr-2 size-4" />
                  {busy === selectedItem.id ? "Menyimpan…" : "Terima vendor"}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
