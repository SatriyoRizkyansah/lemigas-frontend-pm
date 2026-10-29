"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { entityText, dateText } from "@/components/procurement/EntityListPage";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/common/PageHeader";
import { Modal, ModalSection } from "@/components/modal/Modal";
import { EmptyData } from "@/components/loading/EmptyData";
import { ACTIVE_PROCUREMENT_METHODS } from "@/lib/procurement-methods";

type Plan = {
  id: string;
  nomor: string;
  judul: string;
  status: string;
  modelPelaksanaan: string;
  pihakImportir?: string | null;
  namaImportir?: string | null;
  jenisKargo: string;
  satuan: string;
  volumeMin?: number | string | null;
  volumeMax?: number | string | null;
  titikSerah: string;
  penerimaPasokan?: string | null;
  estimasiMulai?: string | null;
  estimasiSelesai?: string | null;
  jenisTransaksi?: string;
  metodeSeleksi?: string;
  deskripsi?: string | null;
  prioritas?: string;
  tanggalPengajuan?: string | null;
  tanggalDeadline?: string | null;
  dasarPemilihan?: string | null;
  strategiPengiriman?: string | null;
  strategiPembiayaan?: string | null;
  spesifikasiMutu?: unknown;
  kesiapanPenerima?: unknown;
  analisisPasar?: unknown;
  createdAt?: string;
  updatedAt?: string;
  disetujuiPada?: string | null;
  approvalSteps?: {
    id: string;
    urutan: number;
    namaLangkah: string;
    status: string;
    penanggungJawab?: string | null;
    penanggungJawabUser?: { nama: string } | null;
    tanggalKeputusan?: string | null;
    catatan?: string | null;
    createdAt?: string;
  }[];
  pengadaan?: { id: string; nomorSurat: string } | null;
};
const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;
const displayValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    if (Array.isArray(value))
      return (
        value
          .map((item) => displayValue(item))
          .filter((item) => item !== "—")
          .join("\n") || "—"
      );
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 1 && entries[0][0] === "catatan" && typeof entries[0][1] === "string") return entries[0][1];
    return (
      entries
        .filter(([, item]) => item !== null && item !== undefined && item !== "")
        .map(([key, item]) => `${key}: ${typeof item === "object" ? displayValue(item) : String(item)}`)
        .join("\n") || "—"
    );
  }
  return String(value);
};

type ParameterRow = { name: string; value: string };
function parseParameterRows(value: string): ParameterRow[] {
  const rows = value
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const separator = line.indexOf(":");
      return separator < 0 ? { name: line.trim(), value: "" } : { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
  return rows.length ? rows : [{ name: "", value: "" }];
}
function serializeParameterRows(rows: ParameterRow[]): string {
  return rows.map((row) => `${row.name}: ${row.value}`).join("\n");
}

const PLAN_DRAFT_KEY = "lemigas:rencana-transaksi:create-draft";
const PLAN_DRAFTS_KEY = "lemigas:rencana-transaksi:drafts";
const PLAN_DRAFT_FIELDS = [
  "judul",
  "modelPelaksanaan",
  "pihakImportir",
  "namaImportir",
  "jenisKargo",
  "jenisTransaksi",
  "metodeSeleksi",
  "prioritas",
  "tanggalPengajuan",
  "tanggalDeadline",
  "volumeMin",
  "volumeMax",
  "satuan",
  "titikSerah",
  "penerimaPasokan",
  "estimasiMulai",
  "estimasiSelesai",
  "deskripsi",
  "spesifikasiMutu",
  "kesiapanPenerima",
  "analisisPasar",
  "dasarPemilihan",
  "strategiPengiriman",
  "strategiPembiayaan",
] as const;
type PlanDraft = Partial<Record<(typeof PLAN_DRAFT_FIELDS)[number], string>>;
type SavedPlanDraft = { id: string; judul: string; savedAt: string; values: PlanDraft };

export default function RencanaTransaksiPage() {
  const [rows, setRows] = useState<Plan[]>([]);
  const user = useCurrentUser();
  const canApprove = user.isSuccess && !user.isRefetchError && ["admin", "pimpinan"].includes(user.data.role.toLowerCase());
  const [busy, setBusy] = useState(false);
  const setError = (message: string) => {
    if (message) window.dispatchEvent(new CustomEvent("api:error", { detail: { message: getApiErrorMessage(new Error(message)) } }));
  };
  const setNotice = (message: string) => {
    if (message) window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
  };
  const [detail, setDetail] = useState<Plan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectStepId, setRejectStepId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedExecutionModel, setSelectedExecutionModel] = useState("");
  const [selectedImporterParty, setSelectedImporterParty] = useState("");
  const [methodHelpOpen, setMethodHelpOpen] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>({});
  const [savedDrafts, setSavedDrafts] = useState<SavedPlanDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      const storedDrafts = window.localStorage.getItem(PLAN_DRAFTS_KEY);
      if (storedDrafts) {
        const parsed: unknown = JSON.parse(storedDrafts);
        if (Array.isArray(parsed)) {
          setSavedDrafts(parsed.filter((item): item is SavedPlanDraft => Boolean(item && typeof item === "object" && typeof item.id === "string" && item.values && typeof item.values === "object")));
        }
      } else {
        const legacy = window.localStorage.getItem(PLAN_DRAFT_KEY);
        if (legacy) {
          const values = JSON.parse(legacy) as PlanDraft;
          const migrated: SavedPlanDraft = { id: crypto.randomUUID(), judul: values.judul?.trim() || "Draft tanpa judul", savedAt: new Date().toISOString(), values };
          setSavedDrafts([migrated]);
          window.localStorage.setItem(PLAN_DRAFTS_KEY, JSON.stringify([migrated]));
          window.localStorage.removeItem(PLAN_DRAFT_KEY);
        }
      }
    } catch {
      setNotice("Daftar draft lokal tidak dapat dibaca. Draft lama mungkin rusak.");
    } finally {
      setDraftLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!draftLoaded || !createFormRef.current) return;
    for (const key of PLAN_DRAFT_FIELDS) {
      const control = createFormRef.current.elements.namedItem(key);
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
        control.value = draft[key] ?? "";
      }
    }
    setSelectedExecutionModel(createFormRef.current.elements.namedItem("modelPelaksanaan") instanceof HTMLSelectElement ? (createFormRef.current.elements.namedItem("modelPelaksanaan") as HTMLSelectElement).value : "");
    setSelectedImporterParty(createFormRef.current.elements.namedItem("pihakImportir") instanceof HTMLSelectElement ? (createFormRef.current.elements.namedItem("pihakImportir") as HTMLSelectElement).value : "");
  }, [draftLoaded, createOpen, selectedDraftId]);
  const refresh = useCallback(async () => {
    try {
      setBrowserToken();
      const result = await apiData(browserApi.ePlanningTransaksi.perencanaanControllerFindAll({ format: "json" }) as Promise<{ data: unknown }>);
      const data = unwrap(result);
      setRows(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat rencana");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  function selectSavedDraft(id: string) {
    const selected = savedDrafts.find((item) => item.id === id);
    if (!selected) return;
    setSelectedDraftId(selected.id);
    setDraft(selected.values);
    setSelectedExecutionModel(selected.values.modelPelaksanaan ?? "");
    setSelectedImporterParty(selected.values.pihakImportir ?? "");
    setNotice(`Draft “${selected.judul}” dimuat ke formulir.`);
    setError("");
  }
  function startNewDraft() {
    setSelectedDraftId(null);
    setDraft({});
    setSelectedExecutionModel("");
    setSelectedImporterParty("");
    createFormRef.current?.reset();
    setNotice("Formulir kosong siap diisi. Draft tersimpan lainnya tetap aman.");
    setError("");
  }
  function deleteSavedDraft(id: string) {
    const remaining = savedDrafts.filter((item) => item.id !== id);
    try {
      window.localStorage.setItem(PLAN_DRAFTS_KEY, JSON.stringify(remaining));
      setSavedDrafts(remaining);
      if (selectedDraftId === id) startNewDraft();
      setNotice("Draft lokal dihapus.");
      setError("");
    } catch {
      setError("Draft lokal gagal dihapus dari browser.");
    }
  }
  function saveLocalDraft() {
    const form = createFormRef.current;
    if (!form) return;
    const values = new FormData(form);
    const nextDraft: PlanDraft = {};
    for (const key of PLAN_DRAFT_FIELDS) nextDraft[key] = String(values.get(key) ?? "");
    try {
      const id = selectedDraftId ?? crypto.randomUUID();
      const saved: SavedPlanDraft = {
        id,
        judul: nextDraft.judul?.trim() || "Draft tanpa judul",
        savedAt: new Date().toISOString(),
        values: nextDraft,
      };
      const nextSavedDrafts = selectedDraftId ? savedDrafts.map((item) => (item.id === selectedDraftId ? saved : item)) : [...savedDrafts, saved];
      window.localStorage.setItem(PLAN_DRAFTS_KEY, JSON.stringify(nextSavedDrafts));
      window.localStorage.removeItem(PLAN_DRAFT_KEY);
      setSavedDrafts(nextSavedDrafts);
      setSelectedDraftId(id);
      setDraft(nextDraft);
      setNotice("Draft disimpan di browser ini saja; belum dikirim ke server.");
      setError("");
    } catch {
      setError("Draft lokal gagal disimpan. Periksa kapasitas penyimpanan browser.");
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const f = new FormData(form);
      const noteObject = (key: string) => {
        const rows = parseParameterRows(String(f.get(key) ?? "")).filter((row) => row.name.trim() && row.value.trim());
        if (new Set(rows.map((row) => row.name.trim().toLocaleLowerCase("id-ID"))).size !== rows.length) {
          throw new Error(`${key}: nama parameter tidak boleh berulang.`);
        }
        return rows.length ? Object.fromEntries(rows.map((row) => [row.name.trim(), row.value.trim()])) : undefined;
      };
      const number = (key: string) => (String(f.get(key) ?? "") ? Number(f.get(key)) : undefined);
      setBrowserToken();
      await browserApi.ePlanningTransaksi.perencanaanControllerCreate(
        {
          judul: String(f.get("judul")),
          modelPelaksanaan: String(f.get("modelPelaksanaan")) as any,
          pihakImportir: String(f.get("modelPelaksanaan")) === "pelaksanaan_impor_langsung" ? "lemigas" : String(f.get("pihakImportir") || "") || undefined,
          namaImportir: String(f.get("namaImportir") || "") || undefined,
          jenisKargo: String(f.get("jenisKargo")),
          satuan: String(f.get("satuan")),
          titikSerah: String(f.get("titikSerah")),
          jenisTransaksi: String(f.get("jenisTransaksi")),
          metodeSeleksi: String(f.get("metodeSeleksi")) as any,
          deskripsi: String(f.get("deskripsi") || "") || undefined,
          volumeMin: number("volumeMin"),
          volumeMax: number("volumeMax"),
          estimasiMulai: String(f.get("estimasiMulai") || "") || undefined,
          estimasiSelesai: String(f.get("estimasiSelesai") || "") || undefined,
          penerimaPasokan: String(f.get("penerimaPasokan") || "") || undefined,
          dasarPemilihan: String(f.get("dasarPemilihan") || "") || undefined,
          strategiPengiriman: String(f.get("strategiPengiriman") || "") || undefined,
          strategiPembiayaan: String(f.get("strategiPembiayaan") || "") || undefined,
          prioritas: String(f.get("prioritas") || "sedang") as any,
          tanggalPengajuan: String(f.get("tanggalPengajuan") || "") || undefined,
          tanggalDeadline: String(f.get("tanggalDeadline") || "") || undefined,
          spesifikasiMutu: noteObject("spesifikasiMutu"),
          kesiapanPenerima: noteObject("kesiapanPenerima"),
          analisisPasar: noteObject("analisisPasar"),
        } as any,
        { format: "json" },
      );
      form.reset();
      setSelectedExecutionModel("");
      setSelectedImporterParty("");
      if (selectedDraftId) {
        const remaining = savedDrafts.filter((item) => item.id !== selectedDraftId);
        window.localStorage.setItem(PLAN_DRAFTS_KEY, JSON.stringify(remaining));
        setSavedDrafts(remaining);
      }
      window.localStorage.removeItem(PLAN_DRAFT_KEY);
      setSelectedDraftId(null);
      setDraft({});
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      window.dispatchEvent(new CustomEvent("api:error", { detail: { message: getApiErrorMessage(e) } }));
    } finally {
      setBusy(false);
    }
  }
  async function act(plan: Plan, action: "submit" | "detail" | "generate") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setBrowserToken();
      if (action === "detail") {
        setDetailLoading(true);
        const result = await apiData(browserApi.ePlanningTransaksi.perencanaanControllerDetail(plan.id, { format: "json" }) as Promise<{ data: unknown }>);
        setDetail(unwrap(result));
      } else if (action === "submit") {
        await browserApi.ePlanningTransaksi.perencanaanControllerSubmit(plan.id, { format: "json" });
        await refresh();
      } else {
        await browserApi.ePlanningTransaksi.perencanaanControllerGeneratePengadaan(plan.id, { prioritas: "sedang" as any }, { format: "json" });
        await refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aksi gagal");
    } finally {
      setBusy(false);
      setDetailLoading(false);
    }
  }
  async function decide(plan: Plan, stepId: string, decision: "disetujui" | "ditolak", catatan = "") {
    setBusy(true);
    setError("");
    try {
      setBrowserToken();
      await browserApi.ePlanningTransaksi.perencanaanControllerDecide(plan.id, stepId, { decision, catatan }, { format: "json" });
      await refresh();
      const result = await apiData(browserApi.ePlanningTransaksi.perencanaanControllerDetail(plan.id, { format: "json" }) as Promise<{ data: unknown }>);
      setDetail(unwrap(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Keputusan gagal");
    } finally {
      setBusy(false);
    }
  }
  const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  const label = "block space-y-1 text-sm font-medium";
  return (
    <main className="space-y-6">
      <PageHeader
        title="Rencana Transaksi"
        description="Susun kebutuhan, analisis pasar, strategi, approval, lalu generate pengadaan."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Buat rencana kebutuhan{savedDrafts.length ? ` · ${savedDrafts.length} draft lokal` : ""}
          </Button>
        }
      />
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Buat rencana kebutuhan"
        description="Isi kebutuhan transaksi. Draft lokal otomatis dimuat dari browser jika tersedia; Buat rencana mengirim data ke server."
        size="xl"
        contentClassName="max-h-[92dvh]"
        bodyClassName="space-y-5 bg-muted/10"
        footer={
          <>
            <Button type="button" variant="outline" onClick={saveLocalDraft} disabled={!draftLoaded || busy}>
              Simpan draft lokal
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Tutup
            </Button>
            <Button type="submit" form="plan-create-form" disabled={busy || !draftLoaded}>
              {busy ? "Menyimpan…" : "Buat rencana"}
            </Button>
          </>
        }
      >
        <form id="plan-create-form" ref={createFormRef} onSubmit={(e) => void create(e)} className="space-y-5" autoComplete="off">
          <ModalSection
            title="Draft lokal"
            description="Pilih draft untuk memuat isinya ke formulir. Draft tersimpan di browser ini."
            action={
              <Button type="button" size="sm" variant="outline" onClick={startNewDraft} disabled={busy}>
                Draft baru
              </Button>
            }
            className="space-y-3"
          >
            {savedDrafts.length ? (
              <ul className="space-y-2">
                {savedDrafts.map((item) => (
                  <li key={item.id} className={`flex items-center gap-2 rounded-md border p-2 ${selectedDraftId === item.id ? "border-primary bg-primary/5" : "bg-background"}`}>
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => selectSavedDraft(item.id)} aria-pressed={selectedDraftId === item.id}>
                      <span className="block truncate text-sm font-medium">{item.judul || "Draft tanpa judul"}</span>
                      <span className="block text-xs text-muted-foreground">Disimpan {new Date(item.savedAt).toLocaleString("id-ID")}</span>
                    </button>
                    <Button type="button" size="sm" variant="outline" onClick={() => deleteSavedDraft(item.id)} aria-label={`Hapus draft ${item.judul}`}>
                      Hapus
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Belum ada draft lokal tersimpan.</p>
            )}
          </ModalSection>
          {selectedDraftId && (
            <p role="status" className="text-xs text-muted-foreground">
              Draft terpilih: {savedDrafts.find((item) => item.id === selectedDraftId)?.judul}
            </p>
          )}
          <ModalSection title="Informasi kebutuhan" className="space-y-4">
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className={`${label} sm:col-span-2 lg:col-span-4`}>
                Judul
                <input required name="judul" maxLength={300} className={input} />
              </label>
              <label className={`${label} lg:col-span-2`}>
                Model pelaksanaan
                <select required name="modelPelaksanaan" className={input} defaultValue="" onChange={(event) => setSelectedExecutionModel(event.target.value)}>
                  <option value="" disabled>
                    Pilih model pelaksanaan
                  </option>
                  <option value="pengelolaan_manajemen_impor">Pengelolaan/manajemen impor</option>
                  <option value="pelaksanaan_impor_langsung">Pelaksanaan impor langsung</option>
                </select>
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Urutan metode seleksi tetap sama. Model ini menentukan importir, dokumen impor, dan jalur Settlement.
                </span>
              </label>
              {selectedExecutionModel === "pengelolaan_manajemen_impor" ? (
                <label className={`${label} sm:col-span-2 lg:col-span-2`}>
                  Pihak yang menjadi importir sesuai perjanjian
                  <select required name="pihakImportir" className={input} defaultValue="" onChange={(event) => setSelectedImporterParty(event.target.value)}>
                    <option value="" disabled>Pilih pihak importir</option>
                    <option value="lemigas">Lemigas</option>
                    <option value="penerima_pasokan">Penerima pasokan</option>
                    <option value="pihak_lain">Pihak lain</option>
                  </select>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Importir mengikuti perjanjian. Di Settlement ada tagihan Penerima Pasokan dan pembayaran Penyedia.</span>
                </label>
              ) : selectedExecutionModel === "pelaksanaan_impor_langsung" ? (
                <div className={`${label} sm:col-span-2 lg:col-span-2 rounded-lg border bg-muted/20 px-3 py-2.5`}>
                  Importir
                  <span className="mt-1 block text-sm font-medium text-foreground">Lemigas</span>
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">Pada model ini Lemigas mengimpor langsung dari Penyedia. Settlement mencatat pembayaran kepada Penyedia.</span>
                </div>
              ) : null}
              {selectedExecutionModel === "pengelolaan_manajemen_impor" ? (
                <label className={`${label} sm:col-span-2 lg:col-span-2`}>
                  Nama importir jika pihak lain
                  <input required={selectedImporterParty === "pihak_lain"} name="namaImportir" maxLength={200} className={input} placeholder="Isi bila memilih Pihak lain" />
                </label>
              ) : null}
              <label className={`${label} lg:col-span-2`}>
                Jenis kargo
                <select required name="jenisKargo" className={input} defaultValue="">
                  <option value="" disabled>
                    Pilih jenis kargo
                  </option>
                  <option value="minyak_bumi">Minyak bumi</option>
                  <option value="bbm">BBM</option>
                  <option value="lpg">LPG</option>
                  <option value="kondensat">Kondensat</option>
                </select>
              </label>
              <label className={`${label} lg:col-span-2`}>
                Jenis transaksi
                <select required name="jenisTransaksi" className={input} defaultValue="">
                  <option value="" disabled>
                    Pilih jenis transaksi
                  </option>
                  <option value="spot">Spot</option>
                  <option value="berjangka">Berjangka</option>
                </select>
              </label>
              <label className={`${label} lg:col-span-2`}>
                Metode seleksi
                <select name="metodeSeleksi" className={input} defaultValue="">
                  <option value="" disabled>
                    Pilih metode seleksi
                  </option>
                  {ACTIVE_PROCUREMENT_METHODS.map(([value, method]) => (
                    <option key={value} value={value}>
                      {method.label}
                    </option>
                  ))}
                </select>
                <span className="mt-2 flex items-center justify-between gap-2 text-xs font-normal normal-case tracking-normal text-muted-foreground">
                  Alur tahapan pengadaan mengikuti metode yang dipilih.
                  <button type="button" className="shrink-0 font-semibold text-primary underline underline-offset-4" onClick={() => setMethodHelpOpen(true)}>
                    Lihat alur metode
                  </button>
                </span>
              </label>
              <label className={`${label} xl:col-span-2`}>
                Prioritas
                <select name="prioritas" className={input} defaultValue="">
                  <option value="" disabled>
                    Pilih prioritas
                  </option>
                  <option value="sedang">Sedang</option>
                  <option value="rendah">Rendah</option>
                  <option value="tinggi">Tinggi</option>
                  <option value="darurat">Darurat</option>
                </select>
              </label>
              <label className={`${label} xl:col-span-2`}>
                Tanggal pengajuan
                <input name="tanggalPengajuan" type="date" className={input} />
              </label>
              <label className={`${label} xl:col-span-2`}>
                Deadline
                <input name="tanggalDeadline" type="date" className={input} />
              </label>
              <label className={`${label} xl:col-span-2`}>
                Volume minimum
                <input name="volumeMin" type="number" min="0" step="any" className={input} />
              </label>
              <label className={`${label} xl:col-span-2`}>
                Volume maksimum
                <input name="volumeMax" type="number" min="0" step="any" className={input} />
              </label>
              <label className={`${label} xl:col-span-2`}>
                Satuan
                <input required name="satuan" placeholder="MT, barrel…" className={input} />
              </label>
              <label className={`${label} lg:col-span-2`}>
                Titik serah
                <input required name="titikSerah" className={input} />
              </label>
              <label className={`${label} lg:col-span-2`}>
                Penerima pasokan
                <input required={selectedImporterParty === "penerima_pasokan"} name="penerimaPasokan" className={input} />
                {selectedImporterParty === "penerima_pasokan" ? <span className="mt-1 block text-xs font-normal text-muted-foreground">Nama ini menjadi identitas pihak importir sesuai perjanjian.</span> : null}
              </label>
              <label className={label}>
                Estimasi mulai
                <input name="estimasiMulai" type="date" className={input} />
              </label>
              <label className={label}>
                Estimasi selesai
                <input name="estimasiSelesai" type="date" className={input} />
              </label>
              <label className={`${label} sm:col-span-2 lg:col-span-4`}>
                Deskripsi kebutuhan
                <textarea name="deskripsi" rows={2} className={input} />
              </label>
            </div>
          </ModalSection>
          <ModalSection title="Analisis dan strategi" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { name: "spesifikasiMutu", label: "Spesifikasi mutu", examples: ["Kadar sulfur", "Densitas", "Warna"] },
                  { name: "kesiapanPenerima", label: "Kesiapan penerima", examples: ["Fasilitas", "Kapasitas", "Jadwal"] },
                  { name: "analisisPasar", label: "Analisis pasar", examples: ["Pasokan", "Harga", "Risiko"] },
                ] as const
              ).map((field) => {
                const rows = parseParameterRows(draft[field.name] ?? "");
                return (
                  <fieldset key={field.name} className={`${label} min-w-0`}>
                    <legend>{field.label}</legend>
                    <p className="text-xs font-normal text-muted-foreground">Tambahkan parameter dan nilainya sesuai kebutuhan.</p>
                    <div className="space-y-2">
                      {rows.map((row, index) => (
                        <div key={`${field.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2">
                          <input
                            aria-label={`${field.label}: parameter ${index + 1}`}
                            placeholder={field.examples[index] ?? "Parameter"}
                            value={row.name}
                            className={input}
                            onChange={(event) => {
                              const next = [...rows];
                              next[index] = { ...row, name: event.target.value };
                              setDraft((current) => ({ ...current, [field.name]: serializeParameterRows(next) }));
                            }}
                          />
                          <input
                            aria-label={`${field.label}: nilai ${index + 1}`}
                            placeholder="Nilai"
                            value={row.value}
                            className={input}
                            onChange={(event) => {
                              const next = [...rows];
                              next[index] = { ...row, value: event.target.value };
                              setDraft((current) => ({ ...current, [field.name]: serializeParameterRows(next) }));
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={`Hapus ${field.label} ${index + 1}`}
                            disabled={rows.length === 1}
                            onClick={() => {
                              const next = rows.filter((_, rowIndex) => rowIndex !== index);
                              setDraft((current) => ({ ...current, [field.name]: serializeParameterRows(next) }));
                            }}
                          >
                            Hapus
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          [field.name]: [...parseParameterRows(current[field.name] ?? ""), { name: "", value: "" }].map((row) => `${row.name}: ${row.value}`).join("\n"),
                        }))
                      }
                    >
                      Tambah parameter
                    </Button>
                    <textarea name={field.name} value={draft[field.name] ?? ""} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
                  </fieldset>
                );
              })}
              <label className={label}>
                Dasar pemilihan
                <textarea name="dasarPemilihan" className={input} />
              </label>
              <label className={label}>
                Strategi pengiriman
                <textarea name="strategiPengiriman" className={input} />
              </label>
              <label className={label}>
                Strategi pembiayaan
                <textarea name="strategiPembiayaan" className={input} />
              </label>
            </div>
          </ModalSection>
        </form>
      </Modal>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {["Nomor / judul", "Metode / prioritas", "Kargo dan volume", "Titik serah", "Estimasi", "Status", "Aksi"].map((x) => (
                <th key={x} className="px-3 py-3 text-left">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-3">
                  <strong>{p.nomor}</strong>
                  <div>{p.judul}</div>
                </td>
                <td className="px-3 py-3">
                  {entityText(p.metodeSeleksi || p.jenisTransaksi || "—")} / {entityText(p.prioritas || "sedang")}
                </td>
                <td className="px-3 py-3">
                  {p.jenisKargo}
                  <div>
                    {p.volumeMin ?? "—"}–{p.volumeMax ?? "—"} {p.satuan}
                  </div>
                </td>
                <td className="px-3 py-3">{p.titikSerah}</td>
                <td className="px-3 py-3">
                  {dateText(p.estimasiMulai)} – {dateText(p.estimasiSelesai)}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={p.status === "disetujui" || p.status === "digenerate" ? "ok" : p.status === "ditolak" ? "danger" : "warn"}>{entityText(p.status)}</StatusBadge>
                </td>
                <td className="space-x-2 whitespace-nowrap px-3 py-3">
                  <Button size="sm" variant="outline" onClick={() => void act(p, "detail")}>
                    Detail / approval
                  </Button>
                  {["draft", "revisi"].includes(p.status) && (
                    <Button size="sm" onClick={() => void act(p, "submit")}>
                      Ajukan
                    </Button>
                  )}
                  {p.status === "disetujui" && (
                    <Button size="sm" onClick={() => void act(p, "generate")}>
                      Buat pengadaan
                    </Button>
                  )}
                  {p.pengadaan && (
                    <Button size="sm" variant="outline" render={<Link href={`/dashboard/pengadaan/${p.pengadaan.id}/siklus`} />}>
                      Siklus
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-2">
                  <EmptyData label="Belum ada rencana transaksi." className="min-h-44 border-0 shadow-none" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {detailLoading && (
        <p role="status" aria-live="polite" className="rounded-xl border p-4">
          Memuat detail rencana…
        </p>
      )}
      {detail && (
        <Modal
          open={Boolean(detail)}
          onClose={() => {
            setDetail(null);
            setRejectStepId(null);
          }}
          title={`${detail.nomor} — ${detail.judul}`}
          description="Ringkasan kebutuhan, jadwal, strategi, dan riwayat persetujuan rencana transaksi."
          size="xl"
          footer={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDetail(null);
                setRejectStepId(null);
              }}
            >
              Tutup detail
            </Button>
          }
          contentClassName="max-w-6xl"
        >
          <div className="space-y-6">
            <section className="rounded-xl border bg-muted/20 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ringkasan rencana</p>
                  <h3 className="mt-1 break-words text-lg font-semibold">{detail.judul}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{detail.nomor}</p>
                </div>
                <span className="rounded-full border bg-background px-3 py-1 text-xs font-semibold capitalize text-foreground">{entityText(detail.status)}</span>
              </div>
            </section>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              {(
                [
                  [
                    "Identifikasi dan status",
                    [
                      ["Dibuat", detail.createdAt ? dateText(detail.createdAt) : undefined],
                      ["Diperbarui", detail.updatedAt ? dateText(detail.updatedAt) : undefined],
                      ["Disetujui pada", detail.disetujuiPada ? dateText(detail.disetujuiPada) : undefined],
                    ],
                  ],
                  [
                    "Model, transaksi, metode",
                    [
                      ["Model pelaksanaan", detail.modelPelaksanaan],
                      ["Jenis transaksi", detail.jenisTransaksi],
                      ["Metode seleksi", detail.metodeSeleksi ? entityText(detail.metodeSeleksi) : undefined],
                    ],
                  ],
                  [
                    "Peran impor",
                    [
                      ["Importir", detail.pihakImportir],
                      ["Nama importir", detail.namaImportir],
                    ],
                  ],
                  [
                    "Kargo dan volume",
                    [
                      ["Jenis kargo", detail.jenisKargo],
                      ["Volume minimum", detail.volumeMin],
                      ["Volume maksimum", detail.volumeMax],
                      ["Satuan", detail.satuan],
                    ],
                  ],
                  [
                    "Serah terima",
                    [
                      ["Titik serah", detail.titikSerah],
                      ["Penerima pasokan", detail.penerimaPasokan],
                    ],
                  ],
                  [
                    "Jadwal estimasi",
                    [
                      ["Mulai", detail.estimasiMulai ? dateText(detail.estimasiMulai) : undefined],
                      ["Selesai", detail.estimasiSelesai ? dateText(detail.estimasiSelesai) : undefined],
                    ],
                  ],
                  [
                    "Dasar dan strategi",
                    [
                      ["Dasar pemilihan", detail.dasarPemilihan],
                      ["Strategi pengiriman", detail.strategiPengiriman],
                      ["Strategi pembiayaan", detail.strategiPembiayaan],
                    ],
                  ],
                ] as [string, [string, unknown][]][]
              ).map(([title, fields]) => (
                <article key={title} className="rounded-xl border bg-card p-4 sm:p-5">
                  <header className="mb-4 border-b pb-3">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {
                        {
                          "Identifikasi dan status": "Nomor referensi, status proses, dan waktu pembaruan rencana.",
                          "Model, transaksi, metode": "Pendekatan pelaksanaan dan cara transaksi dipilih.",
                          "Kargo dan volume": "Komoditas yang dibutuhkan beserta rentang volume dan satuannya.",
                          "Serah terima": "Lokasi serah dan pihak penerima pasokan.",
                          "Jadwal estimasi": "Perkiraan waktu pelaksanaan dan penyelesaian kebutuhan.",
                          "Dasar dan strategi": "Pertimbangan pemilihan serta rencana pengiriman dan pembiayaan.",
                        }[title]
                      }
                    </p>
                  </header>
                  <dl className="grid gap-3">
                    {fields.map(([name, value]) => (
                      <div key={name} className="grid min-w-0 gap-1 border-b border-border/70 pb-2.5 last:border-0 last:pb-0 sm:grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] sm:items-start sm:gap-4">
                        <dt className="text-xs font-medium text-muted-foreground">{name}</dt>
                        <dd className="break-words text-sm font-medium">{["Model pelaksanaan", "Importir", "Jenis transaksi", "Metode seleksi", "Jenis kargo"].includes(name) ? entityText(String(value ?? "")) : displayValue(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
              {(
                [
                  ["Deskripsi", detail.deskripsi],
                  ["Spesifikasi mutu", detail.spesifikasiMutu],
                  ["Kesiapan penerima", detail.kesiapanPenerima],
                  ["Analisis pasar", detail.analisisPasar],
                ] as [string, unknown][]
              ).map(([title, value]) => (
                <article key={title} className="rounded-xl border bg-card p-4 sm:p-5">
                  <header className="mb-3 border-b pb-3">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {
                        {
                          Deskripsi: "Gambaran umum tujuan dan ruang lingkup kebutuhan transaksi.",
                          "Spesifikasi mutu": "Standar, grade, dan parameter kualitas kargo yang disyaratkan.",
                          "Kesiapan penerima": "Kesiapan fasilitas, kapasitas, dan jadwal penerimaan pasokan.",
                          "Analisis pasar": "Kondisi pasokan, permintaan, harga, dan risiko pasar yang menjadi pertimbangan.",
                        }[title]
                      }
                    </p>
                  </header>
                  <div className="min-h-12 rounded-md bg-muted/30 p-3">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{displayValue(value)}</p>
                  </div>
                </article>
              ))}
            </div>
            <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
              <header className="border-b pb-3">
                <h3 className="font-semibold">Alur validasi dan persetujuan</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Rencana diproses berurutan. Setiap tahap hanya dapat ditindaklanjuti oleh peran yang tercantum.</p>
              </header>
              {(detail.approvalSteps ?? []).length > 0 && (
                <p className="text-sm font-medium text-foreground">
                  Tahap {Math.min((detail.approvalSteps ?? []).filter((step) => step.status === "disetujui").length + 1, (detail.approvalSteps ?? []).length)} dari {(detail.approvalSteps ?? []).length}
                </p>
              )}
              {(detail.approvalSteps ?? []).length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Belum ada langkah persetujuan. Ajukan rencana untuk memulai alur approval.</p>
              ) : (
                <ol className="space-y-3">
                  {(detail.approvalSteps ?? []).map((step, index, steps) => {
                    const current = step.status === "menunggu" && !steps.slice(0, index).some((prior) => prior.status === "menunggu");
                    const requiredRole = step.urutan >= 3 ? "Pimpinan" : "Verifikator";
                    const stageState = step.status === "disetujui" ? "Selesai" : step.status === "ditolak" ? "Perlu revisi" : current ? "Menunggu giliran" : "Menunggu tahap sebelumnya";
                    return (
                      <li key={step.id} className={`relative rounded-xl border p-4 sm:p-5 ${current ? "border-primary/40 bg-primary/[0.03] shadow-sm" : "bg-background"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{step.urutan}</span>
                              <h4 className="font-semibold">{step.namaLangkah}</h4>
                              {current && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Tahap aktif</span>}
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <div className="rounded-lg bg-muted/40 px-3 py-2">
                                <p className="text-xs text-muted-foreground">Harus divalidasi oleh</p>
                                <p className="mt-0.5 text-sm font-semibold">{requiredRole}</p>
                              </div>
                              <div className="rounded-lg bg-muted/40 px-3 py-2">
                                <p className="text-xs text-muted-foreground">Status tahap</p>
                                <p className="mt-0.5 text-sm font-semibold">{stageState}</p>
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {step.penanggungJawab ? `Divalidasi oleh ${step.penanggungJawabUser?.nama ?? "Pengguna"}` : `Belum ada ${requiredRole.toLowerCase()} yang memproses tahap ini`}
                              {step.tanggalKeputusan ? ` · ${dateText(step.tanggalKeputusan)}` : ""}
                            </p>
                            {step.createdAt && <p className="mt-1 text-xs text-muted-foreground">Diajukan: {dateText(step.createdAt)}</p>}
                            {step.catatan && <p className="mt-2 whitespace-pre-wrap text-sm">Catatan: {step.catatan}</p>}
                          </div>
                          {current && canApprove && (
                            <div className="flex gap-2">
                              <Button size="sm" disabled={busy} onClick={() => void decide(detail, step.id, "disetujui")}>
                                Setujui
                              </Button>
                              <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejectStepId(step.id)}>
                                Minta revisi
                              </Button>
                            </div>
                          )}
                        </div>
                        {rejectStepId === step.id && (
                          <form
                            className="mt-4 space-y-2 border-t pt-3"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const note = String(new FormData(event.currentTarget).get("catatan") ?? "").trim();
                              if (!note) {
                                setError("Catatan revisi wajib diisi.");
                                return;
                              }
                              setRejectStepId(null);
                              void decide(detail, step.id, "ditolak", note);
                            }}
                          >
                            <label className={label} htmlFor={`reject-note-${step.id}`}>
                              Catatan revisi wajib diisi
                              <textarea id={`reject-note-${step.id}`} name="catatan" required minLength={1} rows={3} className={input} />
                            </label>
                            <div className="flex gap-2">
                              <Button type="submit" variant="destructive" disabled={busy}>
                                Kirim permintaan revisi
                              </Button>
                              <Button type="button" variant="outline" disabled={busy} onClick={() => setRejectStepId(null)}>
                                Batal
                              </Button>
                            </div>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        </Modal>
      )}
      <Modal open={methodHelpOpen} onClose={() => setMethodHelpOpen(false)} title="Rincian alur metode seleksi" description="Urutan tahap, kegiatan utama, dan dokumen yang perlu disiapkan pada setiap metode." size="lg">
        <div className="space-y-5">
          <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed">
            <strong>Alur umum:</strong> Rencana transaksi dibuat dan diajukan untuk persetujuan. Setelah disetujui, sistem membentuk pengadaan dan membuka tahap sesuai metode. PIC melengkapi data serta dokumen pada tahap aktif; pengadaan
            berlanjut setelah pemeriksaan dan approval yang diperlukan.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModalSection title="Tender">
              <ol className="space-y-2 text-sm">
                <li>
                  <strong>1. Perencanaan:</strong> siapkan penugasan dan analisis pasar.
                </li>
                <li>
                  <strong>2. Sourcing:</strong> terbitkan RFQ dan kumpulkan penawaran vendor.
                </li>
                <li>
                  <strong>3. Evaluasi & negosiasi:</strong> verifikasi vendor, evaluasi penawaran, lalu catat hasil negosiasi.
                </li>
                <li>
                  <strong>4. Approval:</strong> ajukan memorandum keputusan untuk persetujuan.
                </li>
                <li>
                  <strong>5. Kontrak:</strong> siapkan kontrak penyedia.
                </li>
                <li>
                  <strong>6. Delivery → Settlement:</strong> catat pengiriman dan BAST, lalu proses invoice serta rekonsiliasi hingga selesai.
                </li>
              </ol>
            </ModalSection>
            <ModalSection title="Pembelian langsung">
              <ol className="space-y-2 text-sm">
                <li>
                  <strong>1. Perencanaan:</strong> siapkan penugasan dan analisis pasar.
                </li>
                <li>
                  <strong>2. Permintaan penawaran/vendor:</strong> minta dan catat penawaran vendor.
                </li>
                <li>
                  <strong>3. Evaluasi sederhana:</strong> evaluasi penawaran dan simpan hasil evaluasi.
                </li>
                <li>
                  <strong>4. Approval:</strong> ajukan memorandum keputusan untuk persetujuan.
                </li>
                <li>
                  <strong>5. PO/kontrak:</strong> terbitkan PO atau kontrak.
                </li>
                <li>
                  <strong>6. Delivery → Settlement:</strong> catat pengiriman dan BAST, lalu proses invoice serta rekonsiliasi hingga selesai.
                </li>
              </ol>
            </ModalSection>
            <ModalSection title="Penunjukan langsung">
              <ol className="space-y-2 text-sm">
                <li>
                  <strong>1. Perencanaan:</strong> siapkan penugasan dan analisis pasar.
                </li>
                <li>
                  <strong>2. Justifikasi penunjukan:</strong> isi alasan dan dokumen dasar penunjukan vendor.
                </li>
                <li>
                  <strong>3. Approval:</strong> ajukan memorandum keputusan dan justifikasi untuk persetujuan.
                </li>
                <li>
                  <strong>4. Negosiasi:</strong> lakukan negosiasi dengan vendor terpilih dan catat hasilnya.
                </li>
                <li>
                  <strong>5. Kontrak:</strong> siapkan kontrak penyedia.
                </li>
                <li>
                  <strong>6. Delivery → Settlement:</strong> catat pengiriman dan BAST, lalu proses invoice serta rekonsiliasi hingga selesai.
                </li>
              </ol>
            </ModalSection>
            <ModalSection title="E-procurement">
              <ol className="space-y-2 text-sm">
                <li>
                  <strong>1. Perencanaan:</strong> siapkan penugasan dan analisis pasar.
                </li>
                <li>
                  <strong>2. Publikasi platform:</strong> publikasikan kebutuhan pada platform pengadaan.
                </li>
                <li>
                  <strong>3. Penawaran elektronik:</strong> terima penawaran melalui platform.
                </li>
                <li>
                  <strong>4. Evaluasi:</strong> evaluasi penawaran elektronik dan simpan hasil evaluasi.
                </li>
                <li>
                  <strong>5. Approval:</strong> ajukan memorandum keputusan untuk persetujuan.
                </li>
                <li>
                  <strong>6. Kontrak:</strong> siapkan kontrak penyedia.
                </li>
                <li>
                  <strong>7. Delivery → Settlement:</strong> catat pengiriman dan BAST, lalu proses invoice serta rekonsiliasi hingga selesai.
                </li>
              </ol>
            </ModalSection>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Tahap dapat meminta dokumen pendukung dan penugasan PIC. Gunakan metode hanya jika sesuai dasar pengadaan serta ketentuan internal yang berlaku.</p>
        </div>
      </Modal>
    </main>
  );
}
