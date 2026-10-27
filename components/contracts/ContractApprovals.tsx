"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { Modal } from "@/components/modal/Modal";
import { Label } from "@/components/ui/label";

type Review = { keputusan: string; catatan?: string | null; checklist?: Record<string, boolean>; dokumen?: { id: string; originalName: string } };
type Contract = {
  id: string;
  pengadaanId: string;
  nomor: string;
  jenis: string;
  revision: number;
  nilai?: number | string | null;
  mataUang?: string;
  status: string;
  pengadaan?: { id: string; nomorSurat: string; judul: string };
  reviews?: Review[];
  dokumen?: Array<{ id: string; jenis: string; originalName: string }>;
};
type Decision = { contract: Contract; decision: "disetujui" | "revisi" };
function unwrap<T>(value: unknown): T {
  let current = value as any;
  for (let i = 0; i < 4 && current && typeof current === "object" && "data" in current; i++) current = current.data;
  return current as T;
}

export function ContractApprovals() {
  const role = useCurrentUser().data?.role?.toLowerCase();
  const [selection, setSelection] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const approvals = use_query<Contract[], Error, string>({
    tag: "contract",
    method: "approvals",
    params: "inbox",
    queryFn: async () => {
      setBrowserToken();
      return unwrap<Contract[]>(await apiData(browserApi.request({ path: "/api/contract-approvals", method: "GET", secure: true, format: "json" })));
    },
  });
  const mutation = use_mutation<unknown, Error, Decision>({
    tag: "contract",
    method: "decision",
    invalidateKeys: [apiQueryKeys.resource("contract"), apiQueryKeys.resource("notifikasi"), apiQueryKeys.resource("auditLog")],
    mutationFn: async ({ contract, decision }) => {
      setBrowserToken();
      return apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(contract.pengadaanId)}/contracts/${encodeURIComponent(contract.id)}/decision`,
          method: "POST",
          secure: true,
          type: "application/json" as any,
          format: "json",
          body: { expectedRevision: contract.revision, decision, ...(decision === "revisi" ? { catatan: note.trim() } : {}) },
        }),
      );
    },
    onSuccess: () => {
      setSelection(null);
      setNote("");
      void approvals.refetch();
    },
  });
  if (role !== "admin" && role !== "pimpinan") return <p className="text-sm text-muted-foreground">Akses persetujuan kontrak khusus Admin dan Pimpinan.</p>;
  if (approvals.isPending) return <LoadingState label="Memuat persetujuan kontrak…" />;
  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">Persetujuan kontrak</h2>
        <p className="text-sm text-muted-foreground">Tinjau draft dan checklist sebelum memberi keputusan.</p>
      </header>
      {approvals.error && (
        <p role="alert" className="text-sm text-destructive">
          {approvals.error.message}
        </p>
      )}
      {!approvals.data?.length ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Tidak ada kontrak menunggu persetujuan.</p>
      ) : (
        approvals.data.map((c) => {
          const review = c.reviews?.find((item) => item.keputusan === "menunggu");
          const doc = review?.dokumen ?? c.dokumen?.find((item) => item.jenis === "draft");
          return (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{c.nomor}</CardTitle>
                <StatusBadge status="warn">Menunggu persetujuan</StatusBadge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  {c.pengadaan?.nomorSurat} · {c.pengadaan?.judul} · {c.jenis.replaceAll("_", " ")}
                </p>
                <p>
                  Nilai: {c.mataUang ?? "USD"} {c.nilai ?? "—"}
                </p>
                {doc && (
                  <a className="text-primary underline" href={`/api/contract-documents/${encodeURIComponent(doc.id)}/download`} target="_blank" rel="noreferrer">
                    Buka PDF draft: {doc.originalName}
                  </a>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(review?.checklist ?? {}).map(([key, checked]) => (
                    <p key={key}>
                      {checked ? "✓" : "✗"} {key.replaceAll(/([A-Z])/g, " $1")}
                    </p>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setSelection({ contract: c, decision: "revisi" })}>
                    Minta revisi
                  </Button>
                  <Button
                    onClick={() => {
                      setNote("");
                      setSelection({ contract: c, decision: "disetujui" });
                    }}
                  >
                    Setujui
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
      <Modal
        open={!!selection}
        onClose={() => !mutation.isPending && setSelection(null)}
        title={selection?.decision === "revisi" ? "Minta revisi kontrak" : "Setujui kontrak"}
        footer={
          <>
            <Button variant="outline" onClick={() => setSelection(null)} disabled={mutation.isPending}>
              Batal
            </Button>
            <Button disabled={mutation.isPending || (selection?.decision === "revisi" && !note.trim())} onClick={() => selection && mutation.mutate(selection)}>
              {mutation.isPending ? "Memproses…" : "Konfirmasi"}
            </Button>
          </>
        }
      >
        {selection?.decision === "revisi" && (
          <div className="space-y-2">
            <Label htmlFor="contract-review-note">Catatan revisi wajib</Label>
            <textarea id="contract-review-note" className="min-h-28 w-full rounded-md border bg-background p-3 text-sm" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        )}
        {mutation.error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {mutation.error.message}
          </p>
        )}
      </Modal>
    </section>
  );
}
