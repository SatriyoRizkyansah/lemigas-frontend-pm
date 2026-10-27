"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, FileText, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDocumentField } from "@/components/documents/DocumentControls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { ContentType } from "@/lib/api/generated/api-generated";

type ContractKind = "penyedia" | "kerja_sama_penerima_pasokan";
type ContractStatus = "draft" | "menunggu_persetujuan" | "menunggu_tanda_tangan_vendor" | "finalisasi_lemigas" | "efektif" | "dipenuhi" | "diakhiri" | "dibatalkan";
type ContractDocument = { id: string; jenis: string; versi: number; originalName: string; createdAt: string };
type Contract = {
  id: string;
  nomor: string;
  jenis: ContractKind;
  jenisHarga: "harga_tetap" | "formula_harga" | "lainnya";
  status: ContractStatus;
  revision: number;
  nilai?: string | number | null;
  mataUang?: string | null;
  formulaHarga?: string | null;
  ketentuanPembayaran?: string | null;
  titikSerah?: string | null;
  pengalihanRisiko?: string | null;
  forceMajeure?: string | null;
  hukumBerlaku?: string | null;
  catatanRevisi?: string | null;
  tanggalTandaTangan?: string | null;
  mulaiBerlaku?: string | null;
  berakhirPada?: string | null;
  dikirimPada?: string | null;
  vendor?: { nama?: string | null } | null;
  dokumen?: ContractDocument[];
};
type Action = "create" | "upload-draft" | "submit" | "send" | "upload-signed" | "finalize";
type ActionState = { action: Action; kind: ContractKind; contract?: Contract } | null;

type DraftForm = {
  nomor: string;
  jenisHarga: Contract["jenisHarga"];
  nilai: string;
  mataUang: string;
  formulaHarga: string;
  ketentuanPembayaran: string;
  titikSerah: string;
  pengalihanRisiko: string;
  forceMajeure: string;
  hukumBerlaku: string;
};

const stages: Array<{ status: ContractStatus; label: string }> = [
  { status: "draft", label: "Draft" },
  { status: "menunggu_persetujuan", label: "Persetujuan" },
  { status: "menunggu_tanda_tangan_vendor", label: "Tanda tangan vendor" },
  { status: "finalisasi_lemigas", label: "Finalisasi LEMIGAS" },
  { status: "efektif", label: "Efektif" },
];
const slots: Array<{ kind: ContractKind; label: string; description: string }> = [
  { kind: "penyedia", label: "Kontrak Penyedia", description: "Perjanjian dengan vendor pemenang pengadaan." },
  { kind: "kerja_sama_penerima_pasokan", label: "Kerja Sama Penerima Pasokan", description: "Perjanjian internal penerimaan dan penyaluran pasokan." },
];
const statusLabels: Record<ContractStatus, string> = {
  draft: "Draft",
  menunggu_persetujuan: "Menunggu persetujuan",
  menunggu_tanda_tangan_vendor: "Tanda tangan vendor",
  finalisasi_lemigas: "Finalisasi LEMIGAS",
  efektif: "Efektif",
  dipenuhi: "Dipenuhi",
  diakhiri: "Diakhiri",
  dibatalkan: "Dibatalkan",
};

function unwrap<T>(value: unknown): T {
  let current = value as any;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && "data" in current; depth += 1) current = current.data;
  return current as T;
}

function currentStep(status?: ContractStatus) {
  if (!status) return -1;
  if (["dipenuhi", "diakhiri"].includes(status)) return 4;
  return stages.findIndex((stage) => stage.status === status);
}

function latestDocument(contract: Contract | undefined, kind: string) {
  return contract?.dokumen?.find((document) => document.jenis === kind);
}

function nextAction(contract: Contract | undefined, kind: ContractKind, canEdit: boolean): ActionState {
  if (!canEdit) return null;
  if (!contract) return { action: "create", kind };
  if (contract.status === "draft") return { action: latestDocument(contract, "draft") ? "submit" : "upload-draft", kind, contract };
  if (contract.status === "menunggu_tanda_tangan_vendor" && !contract.dikirimPada) return { action: "send", kind, contract };
  if (contract.status === "menunggu_tanda_tangan_vendor" && kind === "kerja_sama_penerima_pasokan") return { action: "upload-signed", kind, contract };
  if (contract.status === "finalisasi_lemigas") return { action: "finalize", kind, contract };
  return null;
}

const actionLabels: Record<Action, string> = {
  create: "Buat draft",
  "upload-draft": "Unggah PDF draft",
  submit: "Ajukan persetujuan",
  send: "Kirim untuk tanda tangan",
  "upload-signed": "Unggah hasil tanda tangan",
  finalize: "Finalisasi kontrak",
};

export function ContractWorkspace({ pengadaanId, active }: { pengadaanId: string; active: boolean }) {
  const user = useCurrentUser();
  const role = user.data?.role.toLowerCase() ?? "";
  const canEdit = active && ["admin", "operator"].includes(role);
  const [dialog, setDialog] = useState<ActionState>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftForm>({
    nomor: "",
    jenisHarga: "harga_tetap",
    nilai: "",
    mataUang: "USD",
    formulaHarga: "",
    ketentuanPembayaran: "",
    titikSerah: "",
    pengalihanRisiko: "",
    forceMajeure: "",
    hukumBerlaku: "Indonesia",
  });
  const [signer, setSigner] = useState({ nama: "", jabatan: "", email: "", tanggal: "", mulai: "", berakhir: "" });
  const [checklist, setChecklist] = useState([false, false, false, false, false, false]);

  const contracts = use_query<Contract[], Error, string>({
    tag: "contract",
    method: "list",
    params: pengadaanId,
    queryFn: async (id) => {
      setBrowserToken();
      return unwrap<Contract[]>(await apiData(browserApi.request({ path: `/api/pengadaan/${encodeURIComponent(id)}/contracts`, method: "GET", secure: true, format: "json" })));
    },
  });

  // Fetch procurement (pengadaan) details to prefill draft
  const procurement = use_query<any, Error, string>({
    tag: "pengadaan",
    method: "detail",
    params: pengadaanId,
    queryFn: async (id) => {
      setBrowserToken();
      return unwrap<any>(await apiData(browserApi.request({ path: `/api/pengadaan/${encodeURIComponent(id)}`, method: "GET", secure: true, format: "json" })));
    },
  });

  useEffect(() => {
    if (!dialog) return;
    setFile(null);
    setChecklist([false, false, false, false, false, false]);
    setSigner({ nama: "", jabatan: "", email: "", tanggal: "", mulai: "", berakhir: "" });
    // Default draft values
    let defaultDraft: DraftForm = { nomor: "", jenisHarga: "harga_tetap", nilai: "", mataUang: "USD", formulaHarga: "", ketentuanPembayaran: "", titikSerah: "", pengalihanRisiko: "", forceMajeure: "", hukumBerlaku: "Indonesia" };
    // If creating and procurement data available, prefill from winner
    if (dialog?.action === "create" && procurement.data) {
      const winner = procurement.data.penawaran?.find((p: any) => p.isCurrent);
      if (winner) {
        defaultDraft = {
          ...defaultDraft,
          nilai: winner.hargaPenawaran ? String(winner.hargaPenawaran) : "",
          mataUang: winner.mataUang ?? defaultDraft.mataUang,
          titikSerah: procurement.data.titikSerah ?? "",
        };
      }
    }
    setDraft(defaultDraft);
  }, [dialog?.action, dialog?.kind, procurement.data]);

  const mutation = use_mutation<unknown, Error, NonNullable<ActionState>>({
    tag: "contract",
    method: "command",
    invalidateKeys: [apiQueryKeys.resource("contract"), apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("notifikasi"), apiQueryKeys.resource("auditLog")],
    mutationFn: async (state) => {
      setBrowserToken();
      const base = `/api/pengadaan/${encodeURIComponent(pengadaanId)}/contracts`;
      if (state.action === "create") {
        const body = { ...draft, jenis: state.kind, nilai: draft.nilai ? Number(draft.nilai) : undefined };
        return apiData(browserApi.request({ path: base, method: "POST", secure: true, type: ContentType.Json, format: "json", body }));
      }
      const contract = state.contract!;
      if (state.action === "submit") {
        const names = ["pihakSesuai", "objekDanVolumeSesuai", "hargaSesuai", "jadwalDanTitikSerahSesuai", "ketentuanPembayaranSesuai", "risikoDanKewenanganSesuai"];
        const checklistBody = Object.fromEntries(names.map((name, index) => [name, checklist[index]]));
        return apiData(browserApi.request({ path: `${base}/${contract.id}/submit`, method: "POST", secure: true, type: ContentType.Json, format: "json", body: { expectedRevision: contract.revision, checklist: checklistBody } }));
      }
      if (state.action === "send") {
        return apiData(browserApi.request({ path: `${base}/${contract.id}/send`, method: "POST", secure: true, type: ContentType.Json, format: "json", body: { expectedRevision: contract.revision } }));
      }
      if (!file) throw new Error("Pilih file PDF terlebih dahulu");
      const body = new FormData();
      body.append("file", file);
      body.append("expectedRevision", String(contract.revision));
      let path = `${base}/${contract.id}/draft-document`;
      if (state.action === "upload-signed" || state.action === "finalize") {
        body.append("penandatanganNama", signer.nama);
        body.append("penandatanganJabatan", signer.jabatan);
        if (signer.email) body.append("penandatanganEmail", signer.email);
        body.append("tanggalTandaTangan", new Date(signer.tanggal).toISOString());
      }
      if (state.action === "upload-signed") path = `${base}/${contract.id}/internal-signed-document`;
      if (state.action === "finalize") {
        path = `${base}/${contract.id}/finalize`;
        body.append("mulaiBerlaku", new Date(signer.mulai).toISOString());
        if (signer.berakhir) body.append("berakhirPada", new Date(signer.berakhir).toISOString());
      }
      return apiData(browserApi.request({ path, method: "POST", secure: true, type: ContentType.FormData, format: "json", body }));
    },
    onSuccess: () => setDialog(null),
  });

  const contractsByKind = useMemo(() => new Map((contracts.data ?? []).map((contract) => [contract.jenis, contract])), [contracts.data]);
  const checklistLabels = ["Pihak kontrak sesuai", "Objek dan volume sesuai", "Harga sesuai", "Jadwal dan titik serah sesuai", "Ketentuan pembayaran sesuai", "Risiko dan kewenangan sesuai"];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (dialog) mutation.mutate(dialog);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Proses kontrak</h3>
          <p className="mt-1 text-sm text-muted-foreground">Dua kontrak mengikuti alur persetujuan dan bukti dokumen yang sama.</p>
        </div>
        <Button type="button" size="icon" variant="outline" aria-label="Muat ulang kontrak" onClick={() => void contracts.refetch()} disabled={contracts.isFetching}>
          <RefreshCw className={contracts.isFetching ? "spin" : undefined} />
        </Button>
      </div>
      {contracts.isPending ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {slots.map((slot) => {
            const contract = contractsByKind.get(slot.kind);
            const step = currentStep(contract?.status);
            const action = nextAction(contract, slot.kind, canEdit);
            const status = contract?.status;
            return (
              <Card key={slot.kind} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{slot.label}</CardTitle>
                      <CardDescription className="mt-1">{slot.description}</CardDescription>
                    </div>
                    <StatusBadge status={status === "efektif" || status === "dipenuhi" ? "ok" : status === "dibatalkan" || status === "diakhiri" ? "danger" : status ? "warn" : "neutral"}>
                      {status ? statusLabels[status] : "Belum dibuat"}
                    </StatusBadge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-4">
                  <ol className="grid grid-cols-5 gap-1" aria-label={`Progres ${slot.label}`}>
                    {stages.map((stage, index) => (
                      <li key={stage.status} className="min-w-0 text-center">
                        <span
                          className={`mx-auto grid size-7 place-items-center rounded-full border text-[11px] font-semibold ${index < step ? "border-emerald-600 bg-emerald-600 text-white" : index === step ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                        >
                          {index < step ? <Check size={13} /> : index + 1}
                        </span>
                        <span className="mt-1 hidden text-[10px] leading-3 text-muted-foreground sm:block">{stage.label}</span>
                      </li>
                    ))}
                  </ol>
                  {contract ? (
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Nomor</dt>
                        <dd className="mt-1 font-medium">{contract.nomor}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Pihak</dt>
                        <dd className="mt-1 font-medium">{contract.vendor?.nama ?? (slot.kind === "penyedia" ? "Vendor pemenang" : "Penerima pasokan")}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Revisi</dt>
                        <dd className="mt-1 font-medium">{contract.revision}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Dokumen</dt>
                        <dd className="mt-1 font-medium">{contract.dokumen?.length ?? 0} versi</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Draft kontrak belum tersedia.</p>
                  )}
                  {contract?.dokumen?.length ? (
                    <div className="space-y-2 border-t pt-3">
                      {contract.dokumen.slice(0, 3).map((document) => (
                        <div key={document.id} className="flex items-center gap-2 text-xs">
                          <FileText size={14} className="text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{document.originalName}</span>
                          <span className="text-muted-foreground">
                            {document.jenis.replaceAll("_", " ")} v{document.versi}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
                <CardFooter className="justify-end">
                  {action ? (
                    <Button type="button" onClick={() => setDialog(action)}>
                      {actionLabels[action.action]}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {!active
                        ? "Tahap kontrak tidak aktif"
                        : status === "menunggu_persetujuan"
                          ? "Menunggu keputusan Pimpinan"
                          : status === "menunggu_tanda_tangan_vendor"
                            ? "Menunggu unggahan pihak penandatangan"
                            : status === "efektif"
                              ? "Kontrak sudah berlaku. Pastikan kontrak wajib lainnya efektif, lalu tandai tahap Kontrak selesai untuk lanjut ke Pengiriman."
                              : "Tidak ada aksi saat ini"}
                    </span>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(dialog)}
        onClose={() => !mutation.isPending && setDialog(null)}
        title={dialog ? actionLabels[dialog.action] : "Kontrak"}
        description={dialog?.kind === "penyedia" ? "Kontrak penyedia" : "Kerja sama penerima pasokan"}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={mutation.isPending}>
              Batal
            </Button>
            <Button type="submit" form="contract-action-form" disabled={mutation.isPending || (dialog?.action === "submit" && checklist.some((value) => !value))}>
              {mutation.isPending ? "Memproses..." : dialog ? actionLabels[dialog.action] : "Simpan"}
            </Button>
          </>
        }
      >
        <form id="contract-action-form" className="space-y-4" onSubmit={submit}>
          {dialog?.action === "create" ? (
            <>
              <Field label="Nomor kontrak">
                <Input required value={draft.nomor} onChange={(event) => setDraft({ ...draft, nomor: event.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jenis harga">
                  <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={draft.jenisHarga} onChange={(event) => setDraft({ ...draft, jenisHarga: event.target.value as DraftForm["jenisHarga"] })}>
                    <option value="harga_tetap">Harga tetap</option>
                    <option value="formula_harga">Formula harga</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                </Field>
                <Field label="Nilai">
                  <Input type="number" min="0" value={draft.nilai} onChange={(event) => setDraft({ ...draft, nilai: event.target.value })} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mata uang">
                  <Input value={draft.mataUang} onChange={(event) => setDraft({ ...draft, mataUang: event.target.value })} />
                </Field>
                <Field label="Formula harga">
                  <Input value={draft.formulaHarga} onChange={(event) => setDraft({ ...draft, formulaHarga: event.target.value })} />
                </Field>
              </div>
              <Field label="Ketentuan pembayaran">
                <Input value={draft.ketentuanPembayaran} onChange={(event) => setDraft({ ...draft, ketentuanPembayaran: event.target.value })} />
              </Field>
              <Field label="Titik serah">
                <Input value={draft.titikSerah} onChange={(event) => setDraft({ ...draft, titikSerah: event.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pengalihan risiko">
                  <Input value={draft.pengalihanRisiko} onChange={(event) => setDraft({ ...draft, pengalihanRisiko: event.target.value })} />
                </Field>
                <Field label="Hukum berlaku">
                  <Input value={draft.hukumBerlaku} onChange={(event) => setDraft({ ...draft, hukumBerlaku: event.target.value })} />
                </Field>
              </div>
              <Field label="Force majeure">
                <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={draft.forceMajeure} onChange={(event) => setDraft({ ...draft, forceMajeure: event.target.value })} />
              </Field>
            </>
          ) : null}
          {dialog?.action === "submit" ? (
            <div className="space-y-3">
              {checklistLabels.map((label, index) => (
                <label key={label} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 size-4" checked={checklist[index]} onChange={(event) => setChecklist(checklist.map((value, itemIndex) => (itemIndex === index ? event.target.checked : value)))} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          ) : null}
          {dialog && ["upload-draft", "upload-signed", "finalize"].includes(dialog.action) ? (
            <Field label="File PDF">
              <UploadDocumentField
                key={`${dialog.action}-${dialog.contract?.id ?? ""}-${dialog.contract?.revision ?? ""}`}
                id={`contract-file-${dialog.action}`}
                required
                disabled={mutation.isPending}
                accept="application/pdf,.pdf"
                helperText="PDF · Maksimal 10 MB"
                onFileChange={setFile}
              />
            </Field>
          ) : null}
          {dialog && ["upload-signed", "finalize"].includes(dialog.action) ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama penandatangan">
                  <Input required value={signer.nama} onChange={(event) => setSigner({ ...signer, nama: event.target.value })} />
                </Field>
                <Field label="Jabatan">
                  <Input required value={signer.jabatan} onChange={(event) => setSigner({ ...signer, jabatan: event.target.value })} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email">
                  <Input type="email" value={signer.email} onChange={(event) => setSigner({ ...signer, email: event.target.value })} />
                </Field>
                <Field label="Tanggal tanda tangan">
                  <Input type="datetime-local" required value={signer.tanggal} onChange={(event) => setSigner({ ...signer, tanggal: event.target.value })} />
                </Field>
              </div>
            </>
          ) : null}
          {dialog?.action === "finalize" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mulai berlaku">
                <Input type="datetime-local" required value={signer.mulai} onChange={(event) => setSigner({ ...signer, mulai: event.target.value })} />
              </Field>
              <Field label="Berakhir pada">
                <Input type="datetime-local" value={signer.berakhir} onChange={(event) => setSigner({ ...signer, berakhir: event.target.value })} />
              </Field>
            </div>
          ) : null}
          {dialog?.action === "send" ? <p className="rounded-lg border bg-muted/30 p-3 text-sm">Versi yang telah disetujui akan dikirim kepada pihak penandatangan.</p> : null}
        </form>
      </Modal>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
