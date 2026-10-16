"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { entityText, dateText } from "@/components/procurement/EntityListPage";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/common/StatusBadge";

type Item = { barangId: string; vendorId?: string; jumlah: number; hargaSatuan?: number; catatan?: string; barang?: any; vendor?: any; subtotal?: number };
type Proc = {
  id: string;
  nomorSurat: string;
  judul: string;
  deskripsi?: string;
  metode: string;
  prioritas: string;
  status: string;
  tanggalPengajuan?: string;
  tanggalDeadline?: string;
  unitKerja?: string;
  totalEstimasi?: number;
  items: Item[];
  rencanaTransaksi?: any;
};
type Choice = { id: string; nama: string };
const unwrap = (result: any) => result?.data?.data ?? result?.data ?? result;
function readItems(form: HTMLFormElement): Item[] {
  return Array.from(form.querySelectorAll<HTMLElement>("[data-procurement-item]")).map((row) => {
    const value = (name: string) => (row.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "";
    return { barangId: value("barangId"), vendorId: value("vendorId") || undefined, jumlah: Number(value("jumlah")), hargaSatuan: value("hargaSatuan") ? Number(value("hargaSatuan")) : undefined, catatan: value("catatan") || undefined };
  });
}

export default function PengadaanPage() {
  const [rows, setRows] = useState<Proc[]>([]);
  const [barang, setBarang] = useState<Choice[]>([]);
  const [vendors, setVendors] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<Proc | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("");
  const [createItemCount, setCreateItemCount] = useState(1);
  const [editItemCount, setEditItemCount] = useState(1);
  const refresh = useCallback(async () => {
    setBrowserToken();
    try {
      const result: any = await browserApi.pengadaan.pengadaanGetControllerFindAll({ page, limit: 20, status: (filter || undefined) as any }, { format: "json" });
      const body = result?.data ?? result;
      const data = body?.data ?? body;
      setRows(Array.isArray(data) ? data : (data?.items ?? []));
      setTotalPages(Number(body?.pagination?.total_pages ?? 1));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }, [filter, page]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    setBrowserToken();
    void Promise.all([browserApi.barang.barangGetControllerFindAll({ page: 1, limit: 100 }, { format: "json" }), browserApi.vendor.vendorGetControllerFindAll({ page: 1, limit: 100 }, { format: "json" })])
      .then(([b, v]: any[]) => {
        const bd = unwrap(b),
          vd = unwrap(v);
        setBarang(Array.isArray(bd) ? bd : (bd?.items ?? []));
        setVendors(Array.isArray(vd) ? vd : (vd?.items ?? []));
      })
      .catch(() => {});
  }, []);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      setBrowserToken();
      await browserApi.pengadaan.pengadaanPostControllerCreate(
        {
          judul: String(f.get("judul")),
          deskripsi: String(f.get("deskripsi") || "") || undefined,
          metode: String(f.get("metode")) as any,
          prioritas: String(f.get("prioritas")) as any,
          tanggalPengajuan: String(f.get("tanggalPengajuan") || "") || undefined,
          tanggalDeadline: String(f.get("tanggalDeadline") || "") || undefined,
          unitKerja: String(f.get("unitKerja") || "") || undefined,
          items: [
            {
              barangId: String(f.get("barangId")),
              vendorId: String(f.get("vendorId") || "") || undefined,
              jumlah: Number(f.get("jumlah")),
              hargaSatuan: Number(f.get("hargaSatuan") || 0) || undefined,
              catatan: String(f.get("catatan") || "") || undefined,
            },
          ],
        } as any,
        { format: "json" },
      );
      setNotice("Draft pengadaan berhasil dibuat.");
      form.reset();
      setCreateItemCount(1);
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    try {
      setBrowserToken();
      const result = await apiData(browserApi.pengadaan.pengadaanGetControllerFindOne(id, { format: "json" }) as Promise<{ data: unknown }>);
      const row = unwrap(result);
      setDetail(row);
      setEditItemCount(Math.max(1, row.items?.length ?? 0));
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }
  async function remove(row: Proc) {
    if (!window.confirm(`Hapus pengadaan ${row.nomorSurat}?`)) return;
    setBusy(true);
    try {
      setBrowserToken();
      await browserApi.pengadaan.pengadaanDeleteControllerRemove(row.id, { format: "json" });
      setNotice("Pengadaan dihapus.");
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function update(e: FormEvent<HTMLFormElement>, row: Proc) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      setBrowserToken();
      await browserApi.pengadaan.pengadaanPutControllerUpdate(
        row.id,
        {
          judul: String(f.get("judul")),
          deskripsi: String(f.get("deskripsi") || "") || undefined,
          metode: String(f.get("metode")) as any,
          prioritas: String(f.get("prioritas")) as any,
          tanggalPengajuan: String(f.get("tanggalPengajuan") || "") || undefined,
          tanggalDeadline: String(f.get("tanggalDeadline") || "") || undefined,
          unitKerja: String(f.get("unitKerja") || "") || undefined,
          items: [
            {
              barangId: String(f.get("barangId")),
              vendorId: String(f.get("vendorId") || "") || undefined,
              jumlah: Number(f.get("jumlah")),
              hargaSatuan: Number(f.get("hargaSatuan") || 0) || undefined,
              catatan: String(f.get("catatan") || "") || undefined,
            },
          ],
        } as any,
        { format: "json" },
      );
      setNotice("Draft pengadaan diperbarui.");
      await open(row.id);
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function submit(row: Proc) {
    setBusy(true);
    setError("");
    try {
      setBrowserToken();
      await browserApi.approval.approvalActionControllerSubmit(row.id, { format: "json" });
      setNotice("Pengadaan diajukan untuk approval.");
      await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const input = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  const label = "block space-y-1 text-sm";
  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Pengadaan</h1>
        <p className="text-muted-foreground">Kelola draft, item komoditas, dan siklus transaksi.</p>
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
        <summary className="cursor-pointer font-semibold">Buat pengadaan langsung</summary>
        <form onSubmit={(e) => void create(e)} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className={label}>
            Judul
            <input name="judul" required maxLength={300} className={input} />
          </label>
          <label className={label}>
            Metode
            <select name="metode" className={input}>
              <option value="tender">Tender</option>
              <option value="pengadaan_langsung">Pembelian langsung</option>
              <option value="penunjukan_langsung">Penunjukan langsung</option>
              <option value="e_procurement">E-procurement</option>
            </select>
          </label>
          <label className={label}>
            Prioritas
            <select name="prioritas" className={input}>
              <option value="sedang">Sedang</option>
              <option value="rendah">Rendah</option>
              <option value="tinggi">Tinggi</option>
              <option value="darurat">Darurat</option>
            </select>
          </label>
          <label className={label}>
            Unit kerja
            <input name="unitKerja" className={input} />
          </label>
          <label className={label}>
            Tanggal pengajuan
            <input name="tanggalPengajuan" type="date" className={input} />
          </label>
          <label className={label}>
            Deadline
            <input name="tanggalDeadline" type="date" className={input} />
          </label>
          <label className={`${label} md:col-span-2`}>
            Deskripsi
            <textarea name="deskripsi" className={input} />
          </label>
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Item pengadaan</h3>
              <Button type="button" variant="secondary" onClick={() => setCreateItemCount((n) => n + 1)}>
                Tambah item
              </Button>
            </div>
            {Array.from({ length: createItemCount }, (_, i) => (
              <section key={i} data-procurement-item className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                <label className={label}>
                  Barang / komoditas
                  <select name="barangId" required className={input}>
                    <option value="">Pilih barang</option>
                    {barang.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nama}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Vendor opsional
                  <select name="vendorId" className={input}>
                    <option value="">Belum ditentukan</option>
                    {vendors.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nama}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Jumlah
                  <input name="jumlah" required type="number" min="1" step="1" className={input} />
                </label>
                <label className={label}>
                  Harga satuan estimasi
                  <input name="hargaSatuan" type="number" min="0" step="any" className={input} />
                </label>
                <label className={label}>
                  Catatan item
                  <input name="catatan" className={input} />
                </label>
                {createItemCount > 1 && (
                  <Button type="button" variant="secondary" onClick={() => setCreateItemCount((n) => Math.max(1, n - 1))}>
                    Hapus item
                  </Button>
                )}
              </section>
            ))}
          </div>
          <label className={label}>
            Vendor opsional
            <select name="vendorId" className={input}>
              <option value="">Belum ditentukan</option>
              {vendors.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nama}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Jumlah
            <input name="jumlah" required type="number" min="1" step="1" className={input} />
          </label>
          <label className={label}>
            Harga satuan estimasi
            <input name="hargaSatuan" type="number" min="0" step="any" className={input} />
          </label>
          <label className={label}>
            Catatan item
            <input name="catatan" className={input} />
          </label>
          <div className="md:col-span-2">
            <Button disabled={busy || barang.length === 0}>Simpan draft</Button>
            {barang.length === 0 && <span className="ml-3 text-sm text-muted-foreground">Data barang belum tersedia.</span>}
          </div>
        </form>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Status{" "}
          <select
            value={filter}
            onChange={(e) => {
              setPage(1);
              setFilter(e.target.value);
            }}
            className="ml-2 rounded border bg-background p-2"
          >
            <option value="">Semua</option>
            {["draft", "diajukan", "dalam_review", "disetujui", "ditolak", "revisi", "sedang_proses", "selesai", "dibatalkan"].map((x) => (
              <option key={x} value={x}>
                {entityText(x)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={() => void refresh()}>
          Muat ulang
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              {["Nomor / judul", "Metode / prioritas", "Tanggal", "Estimasi item", "Status", "Aksi"].map((x) => (
                <th key={x} className="px-3 py-3 text-left">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-3">
                  <strong>{r.nomorSurat}</strong>
                  <div>{r.judul}</div>
                  {r.rencanaTransaksi && <div className="text-xs text-muted-foreground">Sumber rencana: {r.rencanaTransaksi.nomor}</div>}
                </td>
                <td className="px-3 py-3">
                  {entityText(r.metode)} / {entityText(r.prioritas)}
                </td>
                <td className="px-3 py-3">
                  Pengajuan {dateText(r.tanggalPengajuan)}
                  <div>Deadline {dateText(r.tanggalDeadline)}</div>
                </td>
                <td className="px-3 py-3">
                  {(r.items ?? []).map((i, index) => (
                    <div key={index}>
                      {entityText(i.barang)} · {i.jumlah} × {i.hargaSatuan ?? 0} = {i.subtotal ?? 0}
                    </div>
                  ))}
                  <strong>Total {r.totalEstimasi ?? 0}</strong>
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={r.status === "selesai" || r.status === "disetujui" ? "ok" : r.status === "ditolak" || r.status === "dibatalkan" ? "danger" : "warn"}>{entityText(r.status)}</StatusBadge>
                </td>
                <td className="space-y-2 px-3 py-3">
                  <Button size="sm" variant="outline" onClick={() => void open(r.id)}>
                    Detail
                  </Button>
                  <Button size="sm" render={<Link href={`/dashboard/pengadaan/${r.id}/siklus`} />}>
                    Siklus
                  </Button>
                  {["draft", "revisi"].includes(r.status) && (
                    <Button size="sm" disabled={busy} onClick={() => void submit(r)}>
                      Ajukan approval
                    </Button>
                  )}
                  {["draft", "revisi", "ditolak"].includes(r.status) && (
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => void remove(r)}>
                      Hapus
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Belum ada pengadaan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-3 text-sm">
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Sebelumnya
        </Button>
        <span>
          Halaman {page} dari {totalPages}
        </span>
        <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Berikutnya
        </Button>
      </div>
      {detail && (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex justify-between">
            <h2 className="text-lg font-semibold">
              {detail.nomorSurat} — {detail.judul}
            </h2>
            <button onClick={() => setDetail(null)}>Tutup</button>
          </div>
          <p>
            {detail.deskripsi || "Tidak ada deskripsi."} · Unit kerja: {detail.unitKerja || "—"}
          </p>
          {detail.rencanaTransaksi && (
            <p>
              Sumber e-Planning: {detail.rencanaTransaksi.nomor} — {detail.rencanaTransaksi.judul}
            </p>
          )}
          <h3 className="font-medium">Rincian komoditas</h3>
          <ul className="space-y-2">
            {(detail.items ?? []).map((i, n) => (
              <li key={n} className="rounded bg-muted/50 p-3">
                {entityText(i.barang)}
                {i.barang?.spesifikasi && <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(i.barang.spesifikasi, null, 2)}</pre>} · Qty {i.jumlah} · Harga {i.hargaSatuan ?? "—"} · Subtotal {i.subtotal ?? "—"}{" "}
                {i.vendor && `· Vendor ${entityText(i.vendor)}`} {i.catatan && `· ${i.catatan}`}
              </li>
            ))}
          </ul>
          <p>Total estimasi: {detail.totalEstimasi ?? "—"}</p>
          {["draft", "revisi"].includes(detail.status) && (
            <form onSubmit={(e) => void update(e, detail)} className="grid gap-3 border-t pt-4 md:grid-cols-2">
              <h3 className="font-semibold md:col-span-2">Edit draft / revisi</h3>
              <label className={label}>
                Judul
                <input name="judul" required defaultValue={detail.judul} className={input} />
              </label>
              <label className={label}>
                Metode
                <select name="metode" defaultValue={detail.metode} className={input}>
                  {["tender", "pengadaan_langsung", "penunjukan_langsung", "e_procurement"].map((x) => (
                    <option key={x} value={x}>
                      {entityText(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Prioritas
                <select name="prioritas" defaultValue={detail.prioritas} className={input}>
                  {["rendah", "sedang", "tinggi", "darurat"].map((x) => (
                    <option key={x} value={x}>
                      {entityText(x)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Unit kerja
                <input name="unitKerja" defaultValue={detail.unitKerja ?? ""} className={input} />
              </label>
              <label className={label}>
                Tanggal pengajuan
                <input name="tanggalPengajuan" type="date" defaultValue={detail.tanggalPengajuan?.slice(0, 10)} className={input} />
              </label>
              <label className={label}>
                Deadline
                <input name="tanggalDeadline" type="date" defaultValue={detail.tanggalDeadline?.slice(0, 10)} className={input} />
              </label>
              <label className={`${label} md:col-span-2`}>
                Deskripsi
                <textarea name="deskripsi" defaultValue={detail.deskripsi ?? ""} className={input} />
              </label>
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <strong>Item pengadaan</strong>
                  <Button type="button" variant="secondary" onClick={() => setEditItemCount((n) => n + 1)}>
                    Tambah item
                  </Button>
                </div>
                {Array.from({ length: editItemCount }, (_, index) => {
                  const item = detail.items?.[index];
                  return (
                    <section key={index} data-procurement-item className="grid gap-3 rounded-lg border p-3 md:grid-cols-2">
                      <label className={label}>
                        Barang
                        <select name="barangId" required defaultValue={item?.barangId ?? ""} className={input}>
                          <option value="">Pilih barang</option>
                          {barang.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nama}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={label}>
                        Vendor
                        <select name="vendorId" defaultValue={item?.vendorId ?? ""} className={input}>
                          <option value="">Belum ditentukan</option>
                          {vendors.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.nama}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={label}>
                        Jumlah
                        <input name="jumlah" required type="number" min="1" defaultValue={item?.jumlah ?? 1} className={input} />
                      </label>
                      <label className={label}>
                        Harga satuan
                        <input name="hargaSatuan" type="number" min="0" step="any" defaultValue={item?.hargaSatuan ?? ""} className={input} />
                      </label>
                      <label className={label}>
                        Catatan item
                        <input name="catatan" defaultValue={item?.catatan ?? ""} className={input} />
                      </label>
                      {editItemCount > 1 && (
                        <Button type="button" variant="secondary" onClick={() => setEditItemCount((n) => Math.max(1, n - 1))}>
                          Hapus item
                        </Button>
                      )}
                    </section>
                  );
                })}
              </div>
              <div className="md:col-span-2">
                <Button disabled={busy}>Simpan perubahan</Button>
              </div>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
