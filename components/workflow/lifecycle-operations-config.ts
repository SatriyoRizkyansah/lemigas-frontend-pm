import { browserApi } from "@/lib/api/browser-client";
import { ContentType, type RequestParams, type UpdateStatusTahapDto } from "@/lib/api/generated/api-generated";
import { ACTIVE_PROCUREMENT_METHODS } from "@/lib/procurement-methods";

export type Entity = Record<string, unknown>;
export type Field = {
  name: string;
  label: string;
  kind?: "number" | "json" | "document-list" | "date" | "boolean" | "textarea";
  required?: boolean;
  min?: number;
  integer?: boolean;
  maxLength?: number;
  options?: readonly string[];
  relation?: string;
  payloadPath?: string;
  multiple?: boolean;
};
export type Operation = {
  key: string;
  title: string;
  stages: string[];
  roles: string[];
  fields: Field[];
  seed?: string;
  available?: (detail: Entity) => boolean;
  run: (id: string, body: Entity) => Promise<unknown>;
};
const api = browserApi.siklusTransaksiKomoditas;
const AO = ["admin", "operator"];
const AOV = [...AO, "verifikator"];
const ALL = [...AOV, "pimpinan"];
const methods = ACTIVE_PROCUREMENT_METHODS.map(([method]) => method);
const statuses: UpdateStatusTahapDto["status"][] = ["draft", "menunggu_persetujuan", "aktif", "selesai", "revisi", "ditolak", "gagal", "dibatalkan"];
const text = (name: string, label: string, required = false, maxLength?: number): Field => ({ name, label, required, maxLength });
const textarea = (name: string, label: string, required = false): Field => ({ name, label, kind: "textarea", required });
const num = (name: string, label: string, min?: number, required = false, integer = false): Field => ({ name, label, kind: "number", min, required, integer });
const json = (name: string, label: string, required = false): Field => ({ name, label, kind: "json", required });
const detailText = (name: string, label: string, payloadPath: string, required = false): Field => ({ name, label, payloadPath, required });
const detailJson = (name: string, label: string, payloadPath: string): Field => ({ name, label, kind: "json", payloadPath });
const documentList = (name: string, label: string, payloadPath?: string): Field => ({ name, label, kind: "document-list", payloadPath });
const date = (name: string, label: string, required = false): Field => ({ name, label, kind: "date", required });
const select = (name: string, label: string, options: readonly string[], required = true): Field => ({ name, label, options, required });
const rel = (name: string, label: string, relation: string, required = false): Field => ({ name, label, relation, required });
const vendor = (required = false, name = "vendorId") => rel(name, "Vendor", "vendor", required);
const vendorMultiple: Field = { name: "vendorIds", label: "Vendor tujuan", relation: "vendor", required: true, multiple: true };
const currency = text("mataUang", "Mata uang (IDR, USD, dll.)", false, 10);
const nomor = text("nomor", "Nomor", true, 100);
const shipmentStatuses = ["direncanakan", "dimuat", "dalam_perjalanan", "tiba", "dibongkar", "diserahkan", "bermasalah"];
const invoiceStatuses = ["draft", "diverifikasi", "diterbitkan", "dibayar_sebagian", "lunas", "ditolak", "dibatalkan"];
// New routes intentionally use public transport until generated client is refreshed.
function operationalUpdate(key: string, title: string, stage: string, relation: string, fields: Field[], roles = AO, suffix = "/status"): Operation {
  return {
    key,
    title,
    stages: [stage],
    roles,
    fields: [rel("entityId", "Catatan", relation, true), ...fields],
    run: (id, { entityId, ...body }) =>
      browserApi.request<unknown, unknown>({
        path: `/api/pengadaan/${encodeURIComponent(id)}/${relation}/${encodeURIComponent(String(entityId))}${suffix}`,
        method: "PUT",
        body,
        type: ContentType.Json,
        format: "json",
        secure: true,
      }),
  };
}

// Generated endpoint supplies DTO type. Runtime schema below validates every body before this boundary.
function create<T extends object>(key: string, title: string, stage: string, endpoint: (id: string, body: T, params?: RequestParams) => Promise<unknown>, fields: Field[], roles = AO, seed?: string): Operation {
  return { key, title, stages: [stage], roles, fields, seed, run: (id, body) => endpoint(id, body as T, { format: "json" }) };
}
function entityStatus(
  key: string,
  title: string,
  stage: string,
  relation: string,
  options: UpdateStatusTahapDto["status"][],
  endpoint: (id: string, entityId: string, body: UpdateStatusTahapDto, params?: RequestParams) => Promise<unknown>,
  roles: string[],
): Operation {
  return {
    key,
    title,
    stages: key === "status-klaim" ? [stage, "selesai"] : [stage],
    roles,
    fields: [rel("entityId", "Catatan", relation, true), select("status", "Status", options)],
    run: (id, body) => endpoint(id, String(body.entityId), { status: body.status as UpdateStatusTahapDto["status"] }, { format: "json" }),
  };
}
export const lifecycleOperations: Operation[] = [
  create(
    "perencanaan",
    "Simpan perencanaan",
    "perencanaan",
    api.transaksiControllerCreatePerencanaan,
    [
      select("modelPelaksanaan", "Model pelaksanaan", ["pengelolaan_manajemen_impor", "pelaksanaan_impor_langsung"]),
      text("jenisKargo", "Jenis kargo", true, 100),
      text("satuan", "Satuan", true, 30),
      text("titikSerah", "Titik serah", true, 200),
      text("nomorPenugasan", "Nomor penugasan", false, 100),
      json("spesifikasiMutu", "Spesifikasi mutu"),
      num("volumeMin", "Volume minimum", 0),
      num("volumeMax", "Volume maksimum", 0),
      date("estimasiMulai", "Estimasi mulai"),
      date("estimasiSelesai", "Estimasi selesai"),
      text("penerimaPasokan", "Penerima pasokan", false, 200),
      json("kesiapanPenerima", "Kesiapan penerima"),
    ],
    AO,
    "perencanaan",
  ),
  create(
    "strategi",
    "Simpan strategi",
    "perencanaan",
    api.transaksiControllerCreateStrategi,
    [
      select("jenisTransaksi", "Jenis transaksi", ["spot", "berjangka"]),
      select("metodeSeleksi", "Metode seleksi", methods),
      json("analisisPasar", "Analisis pasar"),
      textarea("dasarPemilihan", "Dasar pemilihan"),
      textarea("strategiPengiriman", "Strategi pengiriman"),
      textarea("strategiPembiayaan", "Strategi pembiayaan"),
    ],
    AO,
    "strategi",
  ),
  {
    key: "pemilihan-penyedia",
    title: "Inisialisasi penunjukan penyedia",
    stages: ["justifikasi_penunjukan", "permintaan_penawaran"],
    roles: AO,
    fields: [vendorMultiple, textarea("justifikasiPenunjukan", "Justifikasi penunjukan langsung", true)],
    available: (d) => String(d.metode) === "penunjukan_langsung",
    run: (id, body) =>
      browserApi.request<unknown, unknown>({
        path: `/api/pengadaan/${encodeURIComponent(id)}/pemilihan-penyedia`,
        method: "POST",
        body,
        type: ContentType.Json,
        format: "json",
        secure: true,
      }),
  },
  {
    ...create("rfq", "Terbitkan RFQ", "sourcing", api.transaksiControllerCreateRfq, [
      select("mode", "Mode penerbitan", ["baru", "tambah_vendor", "revisi"]),
      { ...rel("rfqId", "RFQ acuan", "rfqAktif"), required: false, multiple: true },
      vendorMultiple,
      nomor,
      text("alasanPerubahan", "Alasan revisi", false, 1000),
      date("batasRespons", "Batas respons"),
      json("spesifikasi", "Spesifikasi kebutuhan"),
      num("volume", "Volume yang diminta", 0),
      text("satuan", "Satuan", false, 30),
      text("titikSerah", "Titik serah", false, 200),
      textarea("syaratPenyerahan", "Syarat penyerahan"),
      textarea("syaratPembayaran", "Syarat pembayaran"),
      documentList("dokumenDiminta", "Dokumen yang diminta"),
    ]),
    stages: ["pemilihan_penyedia", "permintaan_penawaran", "sourcing"],
  },
  ...(["tutup", "buka-kembali"] as const).map((action) => ({
    key: action === "tutup" ? "tutupRfq" : "bukaKembaliRfq",
    title: action === "tutup" ? "Tutup RFQ" : "Buka kembali RFQ",
    stages: ["pemilihan_penyedia", "permintaan_penawaran", "sourcing"],
    roles: AO,
    fields: [rel("rfqId", "RFQ", action === "tutup" ? "rfqAktif" : "rfqTertutup", true), textarea("alasan", "Alasan perubahan", true)],
    run: (id: string, body: Entity) =>
      browserApi.request<unknown, unknown>({
        path: `/api/pengadaan/${encodeURIComponent(id)}/rfq/${encodeURIComponent(String(body.rfqId))}/${action}`,
        method: "POST",
        body: { alasan: body.alasan },
        type: ContentType.Json,
        format: "json",
        secure: true,
      }),
  })),
  {
    ...create(
      "penawaran",
      "Catat penawaran",
      "sourcing",
      api.transaksiControllerCreatePenawaran,
      [
        vendor(true),
        text("nomorRfq", "Nomor RFQ", false, 100),
        num("hargaPenawaran", "Harga penawaran per satuan", 0, true),
        currency,
        date("berlakuSampai", "Berlaku sampai"),
        text("ketentuanPengangkutan", "Ketentuan pengangkutan"),
        text("syaratPembayaran", "Syarat pembayaran"),
        detailText("spesifikasi", "Spesifikasi produk", "spesifikasi"),
        detailText("volume", "Volume yang ditawarkan", "volume"),
        detailText("satuan", "Satuan", "satuan"),
        detailText("asalProduk", "Asal produk", "asalProduk"),
        detailText("pelabuhanMuat", "Pelabuhan muat", "pelabuhanMuat"),
        detailText("waktuPengiriman", "Waktu pengiriman", "waktuPengiriman"),
        detailText("masaBerlakuPenawaran", "Masa berlaku penawaran", "masaBerlaku"),
        detailText("catatan", "Catatan tambahan", "catatan"),
      ],
      [...AO, "vendor"],
    ),
    stages: ["penawaran_vendor", "verifikasi_evaluasi", "permintaan_penawaran", "sourcing"],
  },
  {
    ...create(
      "verifikasi",
      "Simpan verifikasi vendor",
      "evaluasi_negosiasi",
      api.transaksiControllerCreateVerifikasi,
      [
        vendor(true),
        select("kewenangan", "Kewenangan penandatangan", ["selesai", "ditolak", "revisi"]),
        select("kepatuhan", "Kepatuhan terhadap persyaratan pengadaan", ["selesai", "ditolak", "revisi"]),
        select("hasil", "Hasil verifikasi keseluruhan", ["selesai", "ditolak", "revisi"]),
        text("catatan", "Catatan"),
      ],
      ["admin", "verifikator", "member"],
    ),
    stages: ["verifikasi_evaluasi", "verifikasi_vendor", "evaluasi_negosiasi"],
  },
  {
    ...create("negosiasi", "Catat negosiasi", "evaluasi_negosiasi", api.transaksiControllerCreateNegosiasi, [
      rel("penawaranId", "Penawaran vendor", "penawaran", true),
      num("batasNegosiasi", "Target harga internal per satuan", 0),
      num("hargaHasilNegosiasi", "Harga yang diajukan ke vendor per satuan", 0, true),
      textarea("hasil", "Catatan hasil dan kesepakatan"),
    ]),
    stages: ["klarifikasi_negosiasi", "uji_kewajaran_negosiasi", "evaluasi_negosiasi"],
  },
  {
    key: "memorandum",
    title: "Simpan memorandum",
    stages: ["memorandum_keputusan", "approval"],
    roles: AO,
    fields: [
      textarea("rekomendasi", "Uraian rekomendasi dan dasar keputusan", true),
      detailText("analisisRisikoRingkasan", "Risiko dan mitigasi", "analisisRisiko.ringkasan"),
      detailText("kesiapanPembiayaanRingkasan", "Kesiapan pembiayaan", "kesiapanPembiayaan.ringkasan"),
    ],
    seed: "memorandum",
    run: (id, body) => api.transaksiControllerCreateMemorandum(id, body as { rekomendasi: string; analisisRisiko?: object; kesiapanPembiayaan?: object }, { format: "json" }),
    available: (d) => !d.memorandum || ["draft", "revisi"].includes(String((d.memorandum as Entity).status)),
  },
  {
    key: "submit-memorandum",
    title: "Ajukan memorandum",
    stages: ["memorandum_keputusan", "approval"],
    roles: AO,
    fields: [],
    available: (d) => !!d.memorandum && ["draft", "revisi"].includes(String((d.memorandum as Entity).status)),
    run: (id) => browserApi.approval.approvalActionControllerSubmitMemorandum(id, { format: "json" }),
  },
  create("kontrak", "Buat kontrak", "kontrak", api.transaksiControllerCreateKontrak, [
    nomor,
    select("jenis", "Jenis", ["penyedia", "kerja_sama_penerima_pasokan"]),
    select("jenisHarga", "Jenis harga", ["harga_tetap", "formula_harga", "lainnya"]),
    vendor(),
    num("nilai", "Nilai", 0),
    currency,
    text("formulaHarga", "Formula harga"),
    text("ketentuanPembayaran", "Ketentuan pembayaran"),
    text("titikSerah", "Titik serah", false, 200),
    text("pengalihanRisiko", "Pengalihan risiko"),
    text("forceMajeure", "Force majeure"),
    text("hukumBerlaku", "Hukum berlaku", false, 100),
    date("tanggalTandaTangan", "Tanggal tanda tangan"),
    date("mulaiBerlaku", "Mulai berlaku"),
    date("berakhirPada", "Berakhir pada"),
  ]),
  create("adendum", "Buat adendum", "kontrak", api.transaksiControllerCreateAdendum, [rel("kontrakId", "Kontrak", "kontrak", true), nomor, text("alasan", "Alasan", true), json("perubahan", "Perubahan", true)]),
  operationalUpdate(
    "status-kontrak",
    "Ubah status kontrak",
    "kontrak",
    "kontrak",
    [
      select("status", "Status", ["draft", "direview", "disetujui", "ditandatangani", "efektif", "dipenuhi", "diakhiri", "dibatalkan"]),
      date("tanggalTandaTangan", "Tanggal tanda tangan"),
      date("mulaiBerlaku", "Mulai berlaku"),
      date("berakhirPada", "Berakhir pada"),
    ],
    [...AO, "pimpinan"],
  ),
  create("pengiriman", "Catat pengiriman", "delivery", api.transaksiControllerCreatePengiriman, [
    rel("kontrakId", "Kontrak", "kontrak"),
    text("namaKapal", "Nama kapal", false, 150),
    text("nomorBillOfLading", "Nomor bill of lading", false, 100),
    text("pelabuhanMuat", "Pelabuhan muat"),
    text("pelabuhanBongkar", "Pelabuhan bongkar"),
    date("etd", "ETD"),
    date("eta", "ETA"),
    num("volumeKontrak", "Volume kontrak", 0),
  ]),
  operationalUpdate(
    "update-pengiriman",
    "Perbarui pengiriman",
    "delivery",
    "pengiriman",
    [
      rel("kontrakId", "Kontrak", "kontrak"),
      text("namaKapal", "Nama kapal", false, 150),
      text("nomorBillOfLading", "Nomor bill of lading", false, 100),
      text("pelabuhanMuat", "Pelabuhan muat", false, 150),
      text("pelabuhanBongkar", "Pelabuhan bongkar", false, 150),
      date("etd", "ETD"),
      date("eta", "ETA"),
      num("volumeKontrak", "Volume kontrak", 0),
      num("volumeAktual", "Volume aktual", 0),
    ],
    AO,
    "",
  ),
  operationalUpdate("status-pengiriman", "Ubah status pengiriman", "delivery", "pengiriman", [select("status", "Status", shipmentStatuses), num("volumeAktual", "Volume aktual", 0)]),
  create(
    "pemeriksaan",
    "Catat pemeriksaan",
    "delivery",
    api.transaksiControllerCreatePemeriksaan,
    [
      rel("pengirimanId", "Pengiriman", "pengiriman", true),
      text("tipe", "Tipe (quantity, quality, gabungan)", true, 50),
      date("tanggalPeriksa", "Tanggal periksa", true),
      text("surveyor", "Surveyor"),
      num("hasilKuantitas", "Hasil kuantitas"),
      json("hasilMutu", "Hasil mutu"),
      text("nomorSertifikat", "Nomor sertifikat"),
      { name: "diterimaDenganCatatan", label: "Diterima dengan catatan", kind: "boolean" },
      text("catatan", "Catatan"),
    ],
    AOV,
  ),
  create(
    "penerimaan",
    "Catat penerimaan / BAST",
    "delivery",
    api.transaksiControllerCreatePenerimaan,
    [
      rel("pengirimanId", "Pengiriman", "pengiriman", true),
      date("tanggalTerima", "Tanggal terima", true),
      text("titikSerah", "Titik serah", true, 200),
      text("nomorBast", "Nomor BAST", false, 100),
      num("kuantitasDiterima", "Kuantitas diterima"),
      json("mutuDiterima", "Mutu diterima"),
      { name: "denganCatatan", label: "Dengan catatan", kind: "boolean" },
      text("catatan", "Catatan"),
    ],
    AOV,
  ),
  create("penyimpanan", "Catat penyimpanan", "delivery", api.transaksiControllerCreatePenyimpanan, [
    text("fasilitas", "Fasilitas", true, 200),
    text("satuan", "Satuan", true, 30),
    text("lokasi", "Lokasi", false, 200),
    num("kuantitasMasuk", "Kuantitas masuk", 0),
    num("kuantitasKeluar", "Kuantitas keluar", 0),
    text("catatan", "Catatan"),
  ]),
  create(
    "risiko",
    "Catat risiko",
    "delivery",
    api.transaksiControllerCreateRisiko,
    [text("kategori", "Kategori", true, 100), text("deskripsi", "Deskripsi", true), select("tingkat", "Tingkat", ["rendah", "sedang", "tinggi", "kritis"]), text("mitigasi", "Mitigasi")],
    AOV,
  ),
  create("tagihan", "Catat tagihan", "settlement", api.transaksiControllerCreateTagihan, [
    nomor,
    text("pihak", "Pihak", true, 200),
    select("arah", "Arah", ["masuk", "keluar"]),
    num("nilai", "Nilai", 0, true),
    rel("kontrakId", "Kontrak", "kontrak"),
    currency,
    date("jatuhTempo", "Jatuh tempo"),
  ]),
  create(
    "pembayaran",
    "Catat pembayaran",
    "settlement",
    api.transaksiControllerCreatePembayaran,
    [
      nomor,
      num("nilai", "Nilai pembayaran (harus > 0)", 0.0001, true),
      rel("tagihanId", "Tagihan wajib", "tagihan", true),
      text("mataUang", "Mata uang 3 huruf (harus sama dengan tagihan)", false, 3),
      text("rekeningTujuan", "Rekening tujuan", false, 100),
    ],
    [...AO, "pimpinan"],
  ),
  operationalUpdate("status-tagihan", "Ubah status / tanggal tagihan", "settlement", "tagihan", [select("status", "Status", invoiceStatuses), date("jatuhTempo", "Jatuh tempo"), date("diterbitkanPada", "Diterbitkan pada")]),
  operationalUpdate(
    "status-pembayaran",
    "Ubah status / tanggal pembayaran",
    "settlement",
    "pembayaran",
    [select("status", "Status", ["draft", "aktif", "selesai", "dibatalkan"]), date("dibayarPada", "Dibayar pada (status selesai)")],
    [...AO, "pimpinan"],
  ),
  create(
    "rekonsiliasi",
    "Simpan rekonsiliasi",
    "settlement",
    api.transaksiControllerCreateRekonsiliasi,
    [num("selisihVolume", "Selisih volume"), num("selisihNilai", "Selisih nilai"), currency, json("klaim", "Rincian klaim"), text("beritaAcara", "Berita acara", false, 500)],
    AOV,
    "rekonsiliasi",
  ),
  create("klaim", "Catat klaim", "settlement", api.transaksiControllerCreateKlaim, [nomor, text("kategori", "Kategori", true, 100), text("uraian", "Uraian", true), num("nilai", "Nilai", 0), currency], AOV),
  entityStatus("status-klaim", "Ubah status klaim", "settlement", "klaim", ["aktif", "selesai", "ditolak", "dibatalkan"], api.transaksiControllerUpdateStatusKlaim, ALL),
  {
    key: "status-rekonsiliasi",
    title: "Ubah status rekonsiliasi",
    stages: ["settlement", "selesai"],
    roles: ALL,
    fields: [select("status", "Status", ["aktif", "selesai"])],
    available: (d) => !!d.rekonsiliasi,
    run: (id, body) => api.transaksiControllerUpdateStatusRekonsiliasi(id, { status: body.status as UpdateStatusTahapDto["status"] }, { format: "json" }),
  },
  create(
    "laporan",
    "Buat laporan",
    "selesai",
    api.transaksiControllerCreateLaporan,
    [
      text("jenis", "Jenis (periodik, akhir, evaluasi)", true, 50),
      text("ringkasan", "Ringkasan", true),
      date("periodeMulai", "Periode mulai"),
      date("periodeSelesai", "Periode selesai"),
      json("evaluasi", "Evaluasi"),
      text("rekomendasi", "Rekomendasi"),
    ],
    ALL,
  ),
  {
    key: "terbitkan-laporan",
    title: "Terbitkan laporan",
    stages: ["selesai"],
    roles: [...AO, "pimpinan"],
    fields: [rel("laporanId", "Laporan draft", "laporanDraft", true)],
    run: (id, body) => api.transaksiControllerTerbitkanLaporan(id, String(body.laporanId), { format: "json" }),
  },
];

export function operationPayload(fields: Field[], values: Record<string, string>, options: (field: Field) => { value: string; label: string }[]): Entity {
  const body: Entity = {};
  for (const field of fields) {
    const rawValue = values[field.name] ?? "";
    if (field.multiple) {
      const selected = rawValue
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (!selected.length && field.required) throw new Error(`${field.label} wajib diisi.`);
      const available = new Set(options(field).map((item) => item.value));
      if (selected.some((item) => !available.has(item))) throw new Error(`${field.label}: pilih vendor yang tersedia.`);
      if (selected.length) body[field.name] = [...new Set(selected)];
      continue;
    }
    const value = rawValue.trim();
    if (!value) {
      if (field.required) throw new Error(`${field.label} wajib diisi.`);
      continue;
    }
    if (field.maxLength && value.length > field.maxLength) throw new Error(`${field.label}: maksimal ${field.maxLength} karakter.`);
    if (field.relation && !options(field).some((item) => item.value === value)) throw new Error(`${field.label}: pilih relasi yang tersedia.`);
    if (field.options && !field.options.includes(value)) throw new Error(`${field.label}: pilihan tidak valid.`);
    if (field.kind === "document-list") {
      const entries = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const separator = line.indexOf(":");
          const nama = (separator < 0 ? line : line.slice(0, separator)).trim();
          const keterangan = (separator < 0 ? "" : line.slice(separator + 1)).trim();
          if (!nama) throw new Error(`${field.label}: nama dokumen wajib diisi.`);
          return { id: `dokumen-${index + 1}`, nama, wajib: /\bwajib\b/i.test(keterangan), ...(keterangan ? { keterangan } : {}) };
        });
      if (new Set(entries.map((item) => item.nama.toLowerCase())).size !== entries.length) throw new Error(`${field.label}: nama dokumen tidak boleh berulang.`);
      body[field.name] = entries;
    } else if (field.payloadPath) {
      const path = field.payloadPath.split(".");
      const target = path.slice(0, -1).reduce<Entity>((node, key) => {
        const child = node[key];
        if (!child || typeof child !== "object" || Array.isArray(child)) node[key] = {};
        return node[key] as Entity;
      }, body);
      if (field.kind === "json") {
        const entries = value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const separator = line.indexOf(":");
            if (separator < 1 || !line.slice(0, separator).trim() || !line.slice(separator + 1).trim()) throw new Error(`${field.label}: isi setiap baris dengan format “Nama: nilai”.`);
            return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
          });
        target[path.at(-1)!] = Object.fromEntries(entries);
      } else target[path.at(-1)!] = value;
    } else if (field.kind === "number") {
      const number = Number(value);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(number) || (field.integer && !Number.isInteger(number)) || (field.min !== undefined && number < field.min))
        throw new Error(`${field.label}: angka harus valid${field.integer ? ", bulat" : ""}${field.min !== undefined ? `, minimum ${field.min}` : ""}.`);
      body[field.name] = number;
    } else if (field.kind === "json") {
      const entries = value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(":");
          if (separator < 1 || !line.slice(0, separator).trim() || !line.slice(separator + 1).trim()) {
            throw new Error(`${field.label}: isi setiap baris dengan format “Nama: nilai”.`);
          }
          return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
        });
      if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new Error(`${field.label}: nama kolom tidak boleh berulang.`);
      body[field.name] = Object.fromEntries(entries);
    } else if (field.kind === "boolean") {
      if (value !== "true" && value !== "false") throw new Error(`${field.label}: pilihan tidak valid.`);
      body[field.name] = value === "true";
    } else if (field.kind === "date") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error(`${field.label}: tanggal tidak valid.`);
      body[field.name] = new Date(value).toISOString();
    } else body[field.name] = value;
  }
  for (const [start, end] of [
    ["estimasiMulai", "estimasiSelesai"],
    ["periodeMulai", "periodeSelesai"],
    ["etd", "eta"],
    ["mulaiBerlaku", "berakhirPada"],
  ]) {
    if (body[start] && body[end] && String(body[start]) > String(body[end])) throw new Error("Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }
  if (typeof body.volumeMin === "number" && typeof body.volumeMax === "number" && body.volumeMin > body.volumeMax) throw new Error("Volume maksimum tidak boleh kurang dari volume minimum.");
  if (body.dibayarPada && body.status !== "selesai") throw new Error("Tanggal bayar hanya untuk pembayaran selesai.");
  if (body.diterbitkanPada && !["diterbitkan", "dibayar_sebagian", "lunas"].includes(String(body.status))) throw new Error("Tanggal terbit memerlukan status diterbitkan, dibayar sebagian, atau lunas.");
  return body;
}
