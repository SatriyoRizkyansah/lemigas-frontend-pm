"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { browserApi } from "@/lib/api/browser-client";
import { ContentType } from "@/lib/api/generated/api-generated";

type Contract = {
  id: string;
  nomor: string;
  pengadaanId: string;
  jenis: string;
  status: string;
  revision: number;
  pengadaan?: { nomor?: string; nama?: string };
  dokumen?: Array<{ id: string; jenis: string; originalName: string }>;
};

type ActionState = { contract: Contract } | null;
type Signer = { nama: string; jabatan: string; email: string; tanggal: string };

export function VendorContracts() {
  // Helper to extract nested data from API response
  function unwrap<T>(value: unknown): T {
    let current = value as any;
    for (let i = 0; i < 3 && current && typeof current === "object" && "data" in current; i++) {
      current = current.data;
    }
    return current as T;
  }

  const contracts = use_query<Contract[], Error, string>({
    tag: "vendor",
    method: "contracts",
    params: "",
    queryFn: async () => {
      setBrowserToken();
      const resp = await apiData(
        browserApi.request({
          path: `/api/vendor/me/contracts`,
          method: "GET",
          secure: true,
          format: "json",
        }),
      );
      return unwrap<Contract[]>(resp);
    },
  });

  const [dialog, setDialog] = useState<ActionState>(null);
  const [file, setFile] = useState<File | null>(null);
  const [signer, setSigner] = useState<Signer>({ nama: "", jabatan: "", email: "", tanggal: "" });
  useEffect(() => {
    if (dialog) {
      setFile(null);
      setSigner({ nama: "", jabatan: "", email: "", tanggal: "" });
    }
  }, [dialog]);

  const mutation = use_mutation<unknown, Error, NonNullable<ActionState>>({
    tag: "contract",
    method: "command",
    invalidateKeys: [],
    mutationFn: async ({ contract }) => {
      if (!file) throw new Error("Pilih file PDF");
      if (!signer.nama.trim() || !signer.jabatan.trim() || !signer.tanggal) throw new Error("Lengkapi data penandatangan");
      setBrowserToken();
      const body = new FormData();
      body.append("file", file);
      body.append("expectedRevision", String(contract.revision));
      body.append("penandatanganNama", signer.nama.trim());
      body.append("penandatanganJabatan", signer.jabatan.trim());
      if (signer.email.trim()) body.append("penandatanganEmail", signer.email.trim());
      body.append("tanggalTandaTangan", new Date(signer.tanggal).toISOString());
      const path = `/api/vendor/me/contracts/${encodeURIComponent(contract.pengadaanId)}/${encodeURIComponent(contract.id)}/signed-document`;
      return apiData(browserApi.request({ path, method: "POST", secure: true, type: ContentType.FormData, format: "json", body }));
    },
    onSuccess: () => {
      setDialog(null);
      void contracts.refetch();
    },
  });

  if (contracts.isPending) return <LoadingState />;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Kontrak Vendor</h2>
      {contracts.data?.length ? (
        contracts.data.map((c) => (
          <Card key={c.id} className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{c.nomor}</CardTitle>
              <StatusBadge status={c.status === "efektif" ? "ok" : c.status === "dibatalkan" ? "danger" : "warn"}>{c.status}</StatusBadge>
            </CardHeader>
            <CardContent>
              <p>
                Pengadaan: {c.pengadaan?.nomor ?? c.pengadaanId} {c.pengadaan?.nama ?? ""}
              </p>
              <p>
                Jenis: {c.jenis.replaceAll("_", " ")} · Revisi {c.revision}
              </p>
              {c.dokumen
                ?.filter((doc) => ["approved", "final_signed"].includes(doc.jenis))
                .map((doc) => (
                  <p key={doc.id}>
                    <a className="text-primary underline" href={`/api/contract-documents/${encodeURIComponent(doc.id)}/download`} target="_blank" rel="noreferrer">
                      Unduh {doc.jenis === "approved" ? "kontrak untuk ditandatangani" : "kontrak final"}: {doc.originalName}
                    </a>
                  </p>
                ))}
            </CardContent>
            <CardFooter className="justify-end">
              {c.status === "menunggu_tanda_tangan_vendor" && <Button onClick={() => setDialog({ contract: c })}>Unggah kontrak bertanda tangan</Button>}
              {c.status === "finalisasi_lemigas" && <span className="text-xs text-muted-foreground">Menunggu finalisasi LEMIGAS</span>}
            </CardFooter>
          </Card>
        ))
      ) : (
        <p className="text-muted-foreground">Tidak ada kontrak.</p>
      )}

      <Modal
        open={!!dialog}
        onClose={() => setDialog(null)}
        title="Unggah kontrak bertanda tangan"
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={mutation.isPending}>
              Batal
            </Button>
            <Button type="submit" form="contract-action-form" disabled={mutation.isPending}>
              Simpan
            </Button>
          </>
        }
      >
        <form
          id="contract-action-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (dialog) mutation.mutate(dialog);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-signer-name">Nama penandatangan</Label>
              <Input id="vendor-signer-name" required value={signer.nama} onChange={(e) => setSigner({ ...signer, nama: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-signer-title">Jabatan</Label>
              <Input id="vendor-signer-title" required value={signer.jabatan} onChange={(e) => setSigner({ ...signer, jabatan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-signer-email">Email (opsional)</Label>
              <Input id="vendor-signer-email" type="email" value={signer.email} onChange={(e) => setSigner({ ...signer, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-signer-date">Tanggal tanda tangan</Label>
              <Input id="vendor-signer-date" type="date" required value={signer.tanggal} onChange={(e) => setSigner({ ...signer, tanggal: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>File PDF</Label>
            <Input type="file" accept="application/pdf,.pdf" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {mutation.error && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
        </form>
      </Modal>
    </section>
  );
}
