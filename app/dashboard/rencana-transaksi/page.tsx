"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { entityText, dateText } from "@/components/procurement/EntityListPage";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/Button";

type Plan = {
  id: string;
  nomor: string;
  judul: string;
  status: string;
  modelPelaksanaan: string;
  jenisKargo: string;
  satuan: string;
  volumeMin?: number;
  volumeMax?: number;
  titikSerah: string;
  penerimaPasokan?: string;
  estimasiMulai?: string;
  estimasiSelesai?: string;
  approvalSteps?: { id: string; urutan: number; namaLangkah: string; status: string; catatan?: string }[];
  pengadaan?: { id: string; nomorSurat: string } | null;
};
const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;

export default function RencanaTransaksiPage() {
  const [rows, setRows] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<Plan | null>(null);
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
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const f = new FormData(event.currentTarget);
    const json = (key: string) => {
      const v = String(f.get(key) ?? "").trim();
      if (!v) return undefined;
      try {
        return JSON.parse(v);
      } catch {
        throw new Error(`${key} harus berformat JSON valid`);
      }
    };
    const number = (key: string) => (String(f.get(key) ?? "") ? Number(f.get(key)) : undefined);
    try {
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
          spesifikasiMutu: json("spesifikasiMutu"),
          kesiapanPenerima: json("kesiapanPenerima"),
          analisisPasar: json("analisisPasar"),
        } as any,
        { format: "json" },
      );
      setNotice("Rencana berhasil dibuat sebagai draft.");
      event.currentTarget.reset();
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
    }
  }
  async function decide(plan: Plan, stepId: string, decision: "disetujui" | "ditolak") {
    const catatan = decision === "ditolak" ? (window.prompt("Catatan revisi:") ?? "") : "";
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
      <header>
        <h1 className="text-2xl font-bold">Rencana Transaksi</h1>
        <p className="text-muted-foreground">Susun kebutuhan, analisis pasar, strategi, approval, lalu generate pengadaan.</p>
      </header>
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
      <details className="rounded-xl border bg-card p-5">
        <summary className="cursor-pointer font-semibold">Buat rencana kebutuhan</summary>
        <form onSubmit={(e) => void create(e)} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={`${label} md:col-span-2`}>
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
          <label className={`${label} md:col-span-2`}>
            Deskripsi kebutuhan
            <textarea name="deskripsi" rows={2} className={input} />
          </label>
          {[
            ["spesifikasiMutu", "Spesifikasi mutu JSON"],
            ["kesiapanPenerima", "Kesiapan penerima JSON"],
            ["analisisPasar", "Analisis pasar JSON"],
          ].map(([name, title]) => (
            <label key={name} className={label}>
              {title}
              <textarea name={name} rows={3} placeholder='{"catatan":"…"}' className={input} />
            </label>
          ))}
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
          <div className="md:col-span-2">
            <Button disabled={busy}>Simpan draft</Button>
          </div>
        </form>
      </details>
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
      {detail && (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">
              {detail.nomor} — {detail.judul}
            </h2>
            <button onClick={() => setDetail(null)} aria-label="Tutup">
              Tutup
            </button>
          </div>
          <p>
            {detail.jenisKargo}, {detail.volumeMin ?? "—"}–{detail.volumeMax ?? "—"} {detail.satuan}, titik serah {detail.titikSerah}. Penerima: {detail.penerimaPasokan ?? "—"}.
          </p>
          <h3 className="font-medium">Riwayat approval</h3>
          <ol className="space-y-2">
            {(detail.approvalSteps ?? []).map((step) => (
              <li key={step.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/50 p-3">
                <span>
                  {step.urutan}. {step.namaLangkah} — {entityText(step.status)} {step.catatan && `(${step.catatan})`}
                </span>
                {step.status === "menunggu" && (
                  <span className="space-x-2">
                    <Button size="sm" onClick={() => void decide(detail, step.id, "disetujui")}>
                      Setujui
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void decide(detail, step.id, "ditolak")}>
                      Minta revisi
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
