"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import { ContractAddenda, ContractValidityCorrection } from "@/components/contracts/ContractAddenda";

type ContractKind = "penyedia";
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
  adendum?: Array<{ nomor: string; status: string }>;
};
type Action = "create" | "upload-draft" | "submit" | "send" | "finalize";
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
];
const blankDraft = (): DraftForm => ({
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
const priceKindLabels: Record<DraftForm["jenisHarga"], string> = {
  harga_tetap: "Harga tetap",
  formula_harga: "Formula harga",
  lainnya: "Harga lainnya",
};

function object(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function firstValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if ((typeof value === "string" || typeof value === "number") && String(value).trim()) return String(value);
  }
  return undefined;
}

function termValue(terms: Record<string, any>, ...keys: string[]): string | undefined {
  const wanted = new Set(keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, "")));
  const match = Object.entries(terms).find(([key]) => wanted.has(key.toLowerCase().replace(/[^a-z0-9]/g, "")));
  return firstValue(match?.[1]);
}

function priceKind(value: string | undefined, formulaHarga: string | undefined): DraftForm["jenisHarga"] | undefined {
  const normalized = value?.toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (normalized && ["harga_tetap", "tetap", "fixed"].includes(normalized)) return "harga_tetap";
  if (normalized && ["formula_harga", "formula", "berformula"].includes(normalized)) return "formula_harga";
  if (normalized && ["lainnya", "lain"].includes(normalized)) return "lainnya";
  return formulaHarga ? "formula_harga" : undefined;
}

const currencyOptions = [
  { code: "IDR", label: "Rupiah Indonesia", symbol: "Rp" },
  { code: "USD", label: "Dolar Amerika Serikat", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "Pound sterling", symbol: "£" },
  { code: "JPY", label: "Yen Jepang", symbol: "¥" },
  { code: "CNY", label: "Yuan Tiongkok", symbol: "¥" },
  { code: "SGD", label: "Dolar Singapura", symbol: "S$" },
  { code: "MYR", label: "Ringgit Malaysia", symbol: "RM" },
  { code: "AUD", label: "Dolar Australia", symbol: "A$" },
  { code: "CAD", label: "Dolar Kanada", symbol: "C$" },
  { code: "RUB", label: "Rubel Rusia", symbol: "₽" },
] as const;
const currencyPrefixes: Record<string, string> = Object.fromEntries(currencyOptions.map(({ code, symbol }) => [code, symbol]));

function currencyPrefix(currency: string) {
  const code = currency.toUpperCase();
  if (currencyPrefixes[code]) return currencyPrefixes[code];
  try {
    return new Intl.NumberFormat(code === "IDR" ? "id-ID" : "en-US", { style: "currency", currency: code })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(value);
}

function prefillFromProcurement(data: any): { values: Partial<DraftForm>; vendorName?: string; negotiatedPrice: boolean; unitPrice?: string; volume?: string; satuan?: string; totalValue?: number; totalCalculated: boolean } {
  const selection = object(data?.pemilihanPenyedia);
  const winnerId = String(selection.vendorTerpilihId ?? "");
  const participants = Array.isArray(selection.peserta) ? selection.peserta : [];
  const winnerParticipant = participants.find((row: any) => String(row.vendorId) === winnerId);
  const offers = Array.isArray(data?.penawaran) ? data.penawaran : [];
  const matchingOffers = offers
    .filter((offer: any) => String(offer.vendorId) === winnerId && offer.isCurrent !== false)
    .sort((a: any, b: any) => String(b.submittedAt ?? b.updatedAt ?? "").localeCompare(String(a.submittedAt ?? a.updatedAt ?? "")));
  const offer = matchingOffers.find((row: any) => String(row.id) === String(winnerParticipant?.penawaranId ?? "")) ?? matchingOffers[0];
  if (!offer) return { values: {}, negotiatedPrice: false, totalCalculated: false };

  const negotiations = Array.isArray(offer.negosiasi) ? [...offer.negosiasi] : [];
  negotiations.sort((a: any, b: any) => Number(b.putaran) - Number(a.putaran) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  const latestNegotiation = negotiations[0];
  const negotiatedPrice = latestNegotiation?.status === "disepakati" && latestNegotiation.hargaHasilNegosiasi != null;
  const baseline = object(object(offer.detail).rfqBaseline);
  const rfq = (Array.isArray(data?.rfq) ? data.rfq : []).find((row: any) => String(row.id) === String(offer.rfqId));
  const unitPrice = firstValue(negotiatedPrice ? latestNegotiation.hargaHasilNegosiasi : offer.hargaPenawaran);
  const volume = firstValue(baseline.volume, rfq?.volume);
  const satuan = firstValue(baseline.satuan, rfq?.satuan, data?.perencanaan?.satuan);
  const parsedUnitPrice = unitPrice == null ? Number.NaN : Number(unitPrice);
  const parsedVolume = volume == null ? Number.NaN : Number(volume);
  const totalCalculated = Number.isFinite(parsedUnitPrice) && parsedUnitPrice >= 0 && Number.isFinite(parsedVolume) && parsedVolume > 0;
  const totalValue = totalCalculated ? Math.round((parsedUnitPrice * parsedVolume + Number.EPSILON) * 10_000) / 10_000 : undefined;
  const terms = object(rfq?.ketentuan);
  const formulaHarga = firstValue(object(offer.detail).formulaHarga, baseline.formulaHarga, termValue(terms, "formulaHarga", "formula harga"));
  const jenisHarga = priceKind(firstValue(object(offer.detail).jenisHarga, baseline.jenisHarga, termValue(terms, "jenisHarga", "jenis harga")), formulaHarga);
  const hukumBerlaku = firstValue(object(offer.detail).hukumBerlaku, termValue(terms, "hukumBerlaku", "hukum berlaku"));
  return {
    values: {
      ...(totalValue != null ? { nilai: String(totalValue) } : {}),
      ...(firstValue(offer.mataUang) ? { mataUang: firstValue(offer.mataUang)!.toUpperCase() } : {}),
      ...(formulaHarga ? { formulaHarga } : {}),
      ...(jenisHarga ? { jenisHarga } : {}),
      ...(firstValue(offer.syaratPembayaran, baseline.syaratPembayaran, rfq?.syaratPembayaran, termValue(terms, "syaratPembayaran", "syarat pembayaran"))
        ? { ketentuanPembayaran: firstValue(offer.syaratPembayaran, baseline.syaratPembayaran, rfq?.syaratPembayaran, termValue(terms, "syaratPembayaran", "syarat pembayaran"))! }
        : {}),
      ...(firstValue(baseline.titikSerah, rfq?.titikSerah, data?.perencanaan?.titikSerah, data?.rencanaTransaksi?.titikSerah)
        ? { titikSerah: firstValue(baseline.titikSerah, rfq?.titikSerah, data?.perencanaan?.titikSerah, data?.rencanaTransaksi?.titikSerah)! }
        : {}),
      ...(firstValue(object(offer.detail).pengalihanRisiko, termValue(terms, "pengalihanRisiko", "pengalihan risiko")) ? { pengalihanRisiko: firstValue(object(offer.detail).pengalihanRisiko, termValue(terms, "pengalihanRisiko", "pengalihan risiko"))! } : {}),
      ...(firstValue(object(offer.detail).forceMajeure, termValue(terms, "forceMajeure", "force majeure")) ? { forceMajeure: firstValue(object(offer.detail).forceMajeure, termValue(terms, "forceMajeure", "force majeure"))! } : {}),
      ...(hukumBerlaku ? { hukumBerlaku } : {}),
    },
    vendorName: offer.vendor?.nama,
    negotiatedPrice,
    unitPrice,
    volume,
    satuan,
    totalValue,
    totalCalculated,
  };
}

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
  if (contract.status === "finalisasi_lemigas") return { action: "finalize", kind, contract };
  return null;
}

const actionLabels: Record<Action, string> = {
  create: "Buat draft",
  "upload-draft": "Unggah PDF draft",
  submit: "Ajukan persetujuan",
  send: "Kirim untuk tanda tangan",
  finalize: "Finalisasi kontrak",
};

export function ContractWorkspace({ pengadaanId, active, procurement }: { pengadaanId: string; active: boolean; procurement?: Record<string, any> }) {
  const user = useCurrentUser();
  const role = user.data?.role.toLowerCase() ?? "";
  const canEdit = active && ["admin", "operator"].includes(role);
  const canManageContract = ["admin", "operator"].includes(role);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); }, []);
  const [dialog, setDialog] = useState<ActionState>(null);
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<DraftForm>(blankDraft);
  const touchedDraftFields = useRef<Set<keyof DraftForm>>(new Set());
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
  const draftPrefill = useMemo(() => (procurement ? prefillFromProcurement(procurement) : null), [procurement]);

  useEffect(() => {
    if (!dialog?.action) return;
    setFile(null);
    setChecklist([false, false, false, false, false, false]);
    setSigner({ nama: "", jabatan: "", email: "", tanggal: "", mulai: "", berakhir: "" });
    touchedDraftFields.current.clear();
    setDraft(blankDraft());
  }, [dialog?.action, dialog?.kind]);

  useEffect(() => {
    if (dialog?.action !== "create" || !draftPrefill) return;
    const prefill = draftPrefill;
    setDraft((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(prefill.values) as Array<[keyof DraftForm, DraftForm[keyof DraftForm]]>) {
        if (!touchedDraftFields.current.has(key)) next[key] = value as never;
      }
      return next;
    });
  }, [dialog?.action, draftPrefill]);

  function updateDraftField<K extends keyof DraftForm>(field: K, value: DraftForm[K]) {
    touchedDraftFields.current.add(field);
    setDraft((current) => ({ ...current, [field]: value }));
  }

  const mutation = use_mutation<unknown, Error, NonNullable<ActionState>>({
    tag: "contract",
    method: "command",
    invalidateKeys: [apiQueryKeys.resource("contract"), apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("notifikasi"), apiQueryKeys.resource("auditLog")],
    mutationFn: async (state) => {
      setBrowserToken();
      const base = `/api/pengadaan/${encodeURIComponent(pengadaanId)}/contracts`;
      if (state.action === "create") {
        const body = { ...draft, jenis: state.kind, nilai: draft.nilai ? Number(draft.nilai) : undefined, volumeKontrak: draftPrefill?.volume && Number(draftPrefill.volume) > 0 ? Number(draftPrefill.volume) : undefined, satuanKontrak: draftPrefill?.satuan };
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
      if (state.action === "finalize") {
        const start = new Date(`${signer.mulai}:00+07:00`).getTime();
        const end = signer.berakhir ? new Date(`${signer.berakhir}:00+07:00`).getTime() : null;
        if (end !== null && (end <= start || end <= Date.now())) throw new Error("Tanggal berakhir harus setelah tanggal mulai dan belum lewat.");
      }
      const body = new FormData();
      body.append("file", file);
      body.append("expectedRevision", String(contract.revision));
      let path = `${base}/${contract.id}/draft-document`;
      if (state.action === "finalize") {
        body.append("penandatanganNama", signer.nama);
        body.append("penandatanganJabatan", signer.jabatan);
        if (signer.email) body.append("penandatanganEmail", signer.email);
        body.append("tanggalTandaTangan", new Date(`${signer.tanggal}:00+07:00`).toISOString());
      }
      if (state.action === "finalize") {
        path = `${base}/${contract.id}/finalize`;
        body.append("mulaiBerlaku", new Date(`${signer.mulai}:00+07:00`).toISOString());
        if (signer.berakhir) body.append("berakhirPada", new Date(`${signer.berakhir}:00+07:00`).toISOString());
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
          <p className="mt-1 text-sm text-muted-foreground">Kontrak penyedia mengikuti alur persetujuan dan bukti dokumen yang sama.</p>
        </div>
        <Button type="button" size="icon" variant="outline" aria-label="Muat ulang kontrak" onClick={() => void contracts.refetch()} disabled={contracts.isFetching}>
          <RefreshCw className={contracts.isFetching ? "spin" : undefined} />
        </Button>
      </div>
      {contracts.isPending ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4">
          {slots.map((slot) => {
            const contract = contractsByKind.get(slot.kind);
            const step = currentStep(contract?.status);
            const action = nextAction(contract, slot.kind, canEdit);
            const status = contract?.status;
            const expired = status === "efektif" && now !== null && Boolean(contract?.berakhirPada) && new Date(contract!.berakhirPada!).getTime() <= now;
            const future = status === "efektif" && now !== null && Boolean(contract?.mulaiBerlaku) && new Date(contract!.mulaiBerlaku!).getTime() > now;
            return (
              <Card key={slot.kind} className="overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{slot.label}</CardTitle>
                      <CardDescription className="mt-1">{slot.description}</CardDescription>
                    </div>
                    <StatusBadge status={expired ? "danger" : future ? "warn" : status === "efektif" || status === "dipenuhi" ? "ok" : status === "dibatalkan" || status === "diakhiri" ? "danger" : status ? "warn" : "neutral"}>
                      {expired ? "Masa berlaku berakhir" : future ? "Belum mulai berlaku" : status ? statusLabels[status] : "Belum dibuat"}
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
                        <dd className="mt-1 font-medium">{contract.vendor?.nama ?? "Vendor pemenang"}</dd>
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
                  {contract?.status === "efektif" ? <ContractValidityCorrection contract={contract} pengadaanId={pengadaanId} canManage={canManageContract} /> : null}
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
                              ? expired ? "Masa berlaku kontrak telah berakhir. Periksa tanggal pada dokumen final." : future ? "Kontrak belum mulai berlaku." : "Kontrak berlaku. Tandai tahap Kontrak selesai untuk lanjut ke Pengiriman."
                              : "Tidak ada aksi saat ini"}
                    </span>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {contractsByKind.get("penyedia")?.status === "efektif" ? <ContractAddenda pengadaanId={pengadaanId} contract={contractsByKind.get("penyedia")!} canManage={canManageContract} /> : null}

      <Modal
        open={Boolean(dialog)}
        onClose={() => !mutation.isPending && setDialog(null)}
        title={dialog ? actionLabels[dialog.action] : "Kontrak"}
        description="Kontrak dengan vendor pemenang pengadaan."
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
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
                {draftPrefill?.vendorName ? (
                  <>
                    <p className="font-medium text-foreground">Pemenang: {draftPrefill.vendorName}</p>
                    <p>Skema {priceKindLabels[draft.jenisHarga]} mengikuti data penawaran/RFQ. Harga {draftPrefill.negotiatedPrice ? "mengikuti negosiasi yang disepakati" : "mengikuti penawaran aktif"}; mata uang, syarat pembayaran, dan titik serah mengikuti penawaran/RFQ.</p>
                    {draftPrefill.totalCalculated ? (
                      <p className="mt-1 font-medium text-foreground">
                        Perhitungan nilai: {draftPrefill.unitPrice} {draft.mataUang} / {draftPrefill.satuan || "satuan"} × {formatAmount(Number(draftPrefill.volume))} {draftPrefill.satuan || "satuan"} = {currencyPrefix(draft.mataUang)} {formatAmount(draftPrefill.totalValue ?? 0)}
                      </p>
                    ) : (
                      <p className="mt-1">Volume RFQ belum tersedia, jadi nilai total belum dapat dihitung otomatis.</p>
                    )}
                  </>
                ) : (
                  <p>Data penawaran pemenang belum tersedia. Lengkapi nilai kontrak secara manual.</p>
                )}
              </div>
              <Field label="Nomor kontrak">
                <Input required value={draft.nomor} onChange={(event) => updateDraftField("nomor", event.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Jenis harga">
                  <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm" aria-readonly="true">
                    {priceKindLabels[draft.jenisHarga]}
                    <span className="ml-auto text-xs text-muted-foreground">Mengikuti RFQ/penawaran</span>
                  </div>
                </Field>
                <Field label="Nilai total kontrak">
                  <div className="flex h-9 overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring/40">
                    <span className="flex min-w-12 items-center justify-center border-r bg-muted/40 px-3 text-sm font-medium text-muted-foreground">{currencyPrefix(draft.mataUang)}</span>
                    <input
                      aria-label="Nilai total kontrak"
                      type="number"
                      min="0"
                      step="0.0001"
                      inputMode="decimal"
                      readOnly={Boolean(draftPrefill?.totalCalculated)}
                      value={draft.nilai}
                      onChange={(event) => updateDraftField("nilai", event.target.value)}
                      className="w-full min-w-0 bg-transparent px-3 py-2 text-sm outline-none read-only:cursor-default"
                    />
                  </div>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Mata uang">
                  <select
                    aria-label="Mata uang"
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={draft.mataUang}
                    onChange={(event) => updateDraftField("mataUang", event.target.value)}
                  >
                    {!currencyOptions.some(({ code }) => code === draft.mataUang) ? (
                      <option value={draft.mataUang}>{draft.mataUang} — mengikuti penawaran vendor</option>
                    ) : null}
                    {currencyOptions.map(({ code, label, symbol }) => (
                      <option key={code} value={code}>{code} — {label} ({symbol})</option>
                    ))}
                  </select>
                </Field>
                {draft.jenisHarga === "formula_harga" ? (
                  <Field label="Formula harga dari RFQ/negosiasi">
                    <Input value={draft.formulaHarga} readOnly placeholder="Formula belum tersedia pada penawaran/RFQ" />
                  </Field>
                ) : null}
              </div>
              <Field label="Ketentuan pembayaran">
                <Input value={draft.ketentuanPembayaran} onChange={(event) => updateDraftField("ketentuanPembayaran", event.target.value)} />
              </Field>
              <Field label="Titik serah">
                <Input value={draft.titikSerah} onChange={(event) => updateDraftField("titikSerah", event.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pengalihan risiko">
                  <Input value={draft.pengalihanRisiko} onChange={(event) => updateDraftField("pengalihanRisiko", event.target.value)} />
                </Field>
                <Field label="Hukum berlaku">
                  <Input value={draft.hukumBerlaku} onChange={(event) => updateDraftField("hukumBerlaku", event.target.value)} />
                </Field>
              </div>
              <Field label="Force majeure">
                <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={draft.forceMajeure} onChange={(event) => updateDraftField("forceMajeure", event.target.value)} />
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
          {dialog && ["upload-draft", "finalize"].includes(dialog.action) ? (
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
          {dialog?.action === "finalize" ? (
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
                <Field label="Tanggal tanda tangan (WIB)">
                  <Input type="datetime-local" required value={signer.tanggal} onChange={(event) => setSigner({ ...signer, tanggal: event.target.value })} />
                </Field>
              </div>
            </>
          ) : null}
          {dialog?.action === "finalize" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mulai berlaku (WIB)">
                <Input type="datetime-local" required value={signer.mulai} onChange={(event) => setSigner({ ...signer, mulai: event.target.value })} />
              </Field>
              <Field label="Berakhir pada (WIB, opsional)">
                <Input type="datetime-local" value={signer.berakhir} onChange={(event) => setSigner({ ...signer, berakhir: event.target.value })} />
              </Field>
            </div>
          ) : null}
          {dialog?.action === "send" ? <p className="rounded-lg border bg-muted/30 p-3 text-sm">Versi yang telah disetujui akan dikirim kepada pihak penandatangan.</p> : null}
          {dialog?.action === "finalize" ? <p className="text-xs text-muted-foreground">Tanggal berakhir harus setelah mulai berlaku dan belum lewat. Kosongkan jika kontrak tidak mencantumkan tanggal akhir.</p> : null}
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
