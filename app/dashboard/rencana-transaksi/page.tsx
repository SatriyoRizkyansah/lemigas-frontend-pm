"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { entityText, dateText } from "@/components/procurement/EntityListPage";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/common/PageHeader";
import { Modal } from "@/components/modal/Modal";

type Plan = {
  id: string;
  nomor: string;
  judul: string;
  status: string;
  modelPelaksanaan: string;
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
  dasarPemilihan?: string | null;
  strategiPengiriman?: string | null;
  strategiPembiayaan?: string | null;
  spesifikasiMutu?: unknown;
  kesiapanPenerima?: unknown;
  analisisPasar?: unknown;
  createdAt?: string;
  updatedAt?: string;
  disetujuiPada?: string | null;
  approvalSteps?: { id: string; urutan: number; namaLangkah: string; status: string; penanggungJawab?: string | null; tanggalKeputusan?: string | null; catatan?: string | null; createdAt?: string }[];
  pengadaan?: { id: string; nomorSurat: string } | null;
};
const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;
const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "Data tidak dapat ditampilkan";
    }
  }
  return String(value);
};

const PLAN_DRAFT_KEY = "lemigas:rencana-transaksi:create-draft";
const PLAN_DRAFT_FIELDS = [
  "judul",
  "modelPelaksanaan",
  "jenisKargo",
  "jenisTransaksi",
  "metodeSeleksi",
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

export default function RencanaTransaksiPage() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<Plan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectStepId, setRejectStepId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<PlanDraft>({});
  const [draftLoaded, setDraftLoaded] = useState(false);
  const createFormRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PLAN_DRAFT_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const safeDraft: PlanDraft = {};
          for (const key of PLAN_DRAFT_FIELDS) {
            const value = (parsed as Record<string, unknown>)[key];
            if (typeof value !== "string") continue;
            if (["spesifikasiMutu", "kesiapanPenerima", "analisisPasar"].includes(key)) {
              try {
                const legacyValue: unknown = JSON.parse(value);
                if (legacyValue && typeof legacyValue === "object" && "catatan" in legacyValue && typeof legacyValue.catatan === "string") {
                  safeDraft[key] = legacyValue.catatan;
                  continue;
                }
              } catch {
                // Keep older plain-text draft values unchanged.
              }
            }
            safeDraft[key] = value;
          }
          setDraft(safeDraft);
        }
      }
    } catch {
      setNotice("Draft lokal tidak dapat dibaca. Isi formulir baru atau simpan kembali draft.");
    } finally {
      setDraftLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!draftLoaded || !createFormRef.current) return;
    for (const key of PLAN_DRAFT_FIELDS) {
      const control = createFormRef.current.elements.namedItem(key);
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
        control.value = draft[key] ?? (key === "modelPelaksanaan" ? "pengelolaan_manajemen_impor" : key === "metodeSeleksi" ? "tender" : "");
      }
    }
  }, [draft, draftLoaded]);
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
  function saveLocalDraft() {
    const form = createFormRef.current;
    if (!form) return;
    const values = new FormData(form);
    const nextDraft: PlanDraft = {};
    for (const key of PLAN_DRAFT_FIELDS) nextDraft[key] = String(values.get(key) ?? "");
    try {
      window.localStorage.setItem(PLAN_DRAFT_KEY, JSON.stringify(nextDraft));
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
        const catatan = String(f.get(key) ?? "").trim();
        return catatan ? { catatan } : undefined;
      };
      const number = (key: string) => (String(f.get(key) ?? "") ? Number(f.get(key)) : undefined);
      setBrowserToken();
      await browserApi.ePlanningTransaksi.perencanaanControllerCreate(
        {
          judul: String(f.get("judul")),
          modelPelaksanaan: String(f.get("modelPelaksanaan")) as any,
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
          spesifikasiMutu: noteObject("spesifikasiMutu"),
          kesiapanPenerima: noteObject("kesiapanPenerima"),
          analisisPasar: noteObject("analisisPasar"),
        } as any,
        { format: "json" },
      );
      setNotice("Rencana berhasil dibuat sebagai draft di server.");
      form.reset();
      window.localStorage.removeItem(PLAN_DRAFT_KEY);
      setDraft({});
      setCreateOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat rencana");
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
        setNotice("Rencana diajukan untuk approval.");
        await refresh();
      } else {
        await browserApi.ePlanningTransaksi.perencanaanControllerGeneratePengadaan(plan.id, { prioritas: "sedang" as any }, { format: "json" });
        setNotice("Pengadaan berhasil dibuat.");
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
      setNotice(`Approval ${decision}.`);
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
            Buat rencana kebutuhan{Object.values(draft).some(Boolean) ? " · Draft lokal tersedia" : ""}
          </Button>
        }
      />
      {error && (
        <p role="alert" className="rounded border border-destructive p-3 text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded border border-emerald-600 p-3 text-sm">
          {notice}
        </p>
      )}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Buat rencana kebutuhan"
        description="Isi kebutuhan transaksi. Simpan draft hanya menyimpan data di browser ini; Buat rencana mengirim data ke server."
        size="lg"
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
        <form id="plan-create-form" ref={createFormRef} onSubmit={(e) => void create(e)} className="space-y-5">
          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Informasi kebutuhan</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`${label} sm:col-span-2`}>
                Judul
                <input required name="judul" maxLength={300} className={input} />
              </label>
              <label className={label}>
                Model pelaksanaan
                <select name="modelPelaksanaan" className={input}>
                  <option value="pengelolaan_manajemen_impor">Pengelolaan/manajemen impor</option>
                  <option value="pelaksanaan_impor_langsung">Pelaksanaan impor langsung</option>
                </select>
              </label>
              <label className={label}>
                Jenis kargo
                <input required name="jenisKargo" placeholder="Minyak bumi, BBM, LPG…" className={input} />
              </label>
              <label className={label}>
                Jenis transaksi
                <input required name="jenisTransaksi" placeholder="Spot / berjangka" className={input} />
              </label>
              <label className={label}>
                Metode seleksi
                <select name="metodeSeleksi" className={input}>
                  <option value="tender">Tender</option>
                  <option value="pengadaan_langsung">Pembelian langsung</option>
                  <option value="penunjukan_langsung">Penunjukan langsung</option>
                  <option value="e_procurement">E-procurement</option>
                </select>
              </label>
              <label className={label}>
                Volume minimum
                <input name="volumeMin" type="number" min="0" step="any" className={input} />
              </label>
              <label className={label}>
                Volume maksimum
                <input name="volumeMax" type="number" min="0" step="any" className={input} />
              </label>
              <label className={label}>
                Satuan
                <input required name="satuan" placeholder="MT, barrel…" className={input} />
              </label>
              <label className={label}>
                Titik serah
                <input required name="titikSerah" className={input} />
              </label>
              <label className={label}>
                Penerima pasokan
                <input name="penerimaPasokan" className={input} />
              </label>
              <label className={label}>
                Estimasi mulai
                <input name="estimasiMulai" type="date" className={input} />
              </label>
              <label className={label}>
                Estimasi selesai
                <input name="estimasiSelesai" type="date" className={input} />
              </label>
              <label className={`${label} sm:col-span-2`}>
                Deskripsi kebutuhan
                <textarea name="deskripsi" rows={2} className={input} />
              </label>
            </div>
          </section>
          <section className="space-y-4 border-t pt-5">
            <h2 className="text-sm font-semibold">Analisis dan strategi</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`${label} sm:col-span-2`}>
                Spesifikasi mutu
                <textarea name="spesifikasiMutu" rows={3} placeholder="Jelaskan standar mutu, grade, atau parameter kualitas yang dibutuhkan." className={input} />
              </label>
              <label className={label}>
                Kesiapan penerima
                <textarea name="kesiapanPenerima" rows={3} placeholder="Jelaskan kesiapan fasilitas, kapasitas, atau jadwal penerimaan." className={input} />
              </label>
              <label className={label}>
                Analisis pasar
                <textarea name="analisisPasar" rows={3} placeholder="Tuliskan kondisi pasokan, permintaan, harga, atau risiko pasar." className={input} />
              </label>
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
          </section>
        </form>
      </Modal>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {["Nomor / judul", "Kargo dan volume", "Titik serah", "Estimasi", "Status", "Aksi"].map((x) => (
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
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Belum ada rencana transaksi.
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
        <section aria-labelledby="plan-detail-heading" className="space-y-5 rounded-xl border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="plan-detail-heading" className="text-lg font-semibold">
                {detail.nomor} — {detail.judul}
              </h2>
              <p className="text-sm text-muted-foreground">Detail rencana dan alur persetujuan</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDetail(null);
                setRejectStepId(null);
              }}
              aria-label="Tutup detail rencana"
            >
              Tutup
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                [
                  "Identifikasi dan status",
                  [
                    ["Nomor", detail.nomor],
                    ["Judul", detail.judul],
                    ["Status", entityText(detail.status)],
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
              <article key={title} className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">{title}</h3>
                <dl className="space-y-2">
                  {fields.map(([name, value]) => (
                    <div key={name}>
                      <dt className="text-xs text-muted-foreground">{name}</dt>
                      <dd className="break-words text-sm">{displayValue(value)}</dd>
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
              <article key={title} className="rounded-lg border p-4">
                <h3 className="mb-2 font-semibold">{title}</h3>
                {typeof value === "object" && value !== null ? (
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/50 p-3 text-xs" aria-label={`${title} dalam format JSON`}>
                    {displayValue(value)}
                  </pre>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm">{displayValue(value)}</p>
                )}
              </article>
            ))}
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Riwayat approval</h3>
            {(detail.approvalSteps ?? []).length === 0 ? (
              <p className="rounded border border-dashed p-4 text-sm text-muted-foreground">Belum ada langkah approval.</p>
            ) : (
              <ol className="space-y-3">
                {(detail.approvalSteps ?? []).map((step, index, steps) => {
                  const current = step.status === "menunggu" && !steps.slice(0, index).some((prior) => prior.status === "menunggu");
                  return (
                    <li key={step.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 className="font-medium">
                            {step.urutan}. {step.namaLangkah}
                          </h4>
                          <p className="mt-1 text-sm">
                            Status: {entityText(step.status)}
                            {current ? " · Tahap aktif" : ""}
                          </p>
                          <p className="text-sm text-muted-foreground">Approver ID: {step.penanggungJawab ?? "Belum ditetapkan"}</p>
                          <p className="text-sm text-muted-foreground">
                            Dibuat: {step.createdAt ? dateText(step.createdAt) : "—"} · Keputusan: {step.tanggalKeputusan ? dateText(step.tanggalKeputusan) : "—"}
                          </p>
                          {step.catatan && <p className="mt-2 whitespace-pre-wrap text-sm">Catatan: {step.catatan}</p>}
                        </div>
                        {current && (
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
          </div>
        </section>
      )}
    </main>
  );
}
