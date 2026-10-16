import { browserApi } from "@/lib/api/browser-client";
import { ContentType, type RequestParams, type UpdateStatusTahapDto } from "@/lib/api/generated/api-generated";

export type Entity = Record<string, unknown>;
export type Field = {
  name: string;
  label: string;
  kind?: "number" | "json" | "date" | "boolean";
  required?: boolean;
  min?: number;
  integer?: boolean;
  maxLength?: number;
  options?: readonly string[];
  relation?: string;
  payloadPath?: string;
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
const methods = ["tender", "pengadaan_langsung", "penunjukan_langsung", "e_procurement"];
const statuses: UpdateStatusTahapDto["status"][] = ["draft", "menunggu_persetujuan", "aktif", "selesai", "revisi", "ditolak", "gagal", "dibatalkan"];
const text = (name: string, label: string, required = false, maxLength?: number): Field => ({ name, label, required, maxLength });
const num = (name: string, label: string, min?: number, required = false, integer = false): Field => ({ name, label, kind: "number", min, required, integer });
const json = (name: string, label: string, required = false): Field => ({ name, label, kind: "json", required });
const detailText = (name: string, label: string, payloadPath: string, required = false): Field => ({ name, label, payloadPath, required });
const date = (name: string, label: string, required = false): Field => ({ name, label, kind: "date", required });
const select = (name: string, label: string, options: readonly string[], required = true): Field => ({ name, label, options, required });
const rel = (name: string, label: string, relation: string, required = false): Field => ({ name, label, relation, required });
const vendor = (required = false, name = "vendorId") => rel(name, "Vendor", "vendor", required);
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
      text("jenisTransaksi", "Jenis transaksi (spot, berjangka, dll.)", true, 50),
      select("metodeSeleksi", "Metode seleksi", methods),
      json("analisisPasar", "Analisis pasar"),
      text("dasarPemilihan", "Dasar pemilihan"),
      text("strategiPengiriman", "Strategi pengiriman"),
      text("strategiPembiayaan", "Strategi pembiayaan"),
    ],
    AO,
    "strategi",
  ),
  create("rfq", "Terbitkan RFQ", "sourcing", api.transaksiControllerCreateRfq, [
    vendor(true),
    nomor,
    date("batasRespons", "Batas respons"),
    detailText("spesifikasi", "Spesifikasi kebutuhan", "spesifikasi"),
    detailText("volume", "Volume yang diminta", "volume"),
    detailText("satuan", "Satuan", "satuan"),
    detailText("titikSerah", "Titik serah", "titikSerah"),
    detailText("syaratPenyerahan", "Syarat penyerahan", "syaratPenyerahan"),
    detailText("syaratPembayaran", "Syarat pembayaran", "syaratPembayaran"),
    detailText("dokumenDiminta", "Dokumen yang diminta", "dokumenDiminta"),
  ]),
  create(
    "penawaran",
    "Catat penawaran",
    "sourcing",
    api.transaksiControllerCreatePenawaran,
    [
      vendor(true),
      text("nomorRfq", "Nomor RFQ", false, 100),
      text("hargaAcuan", "Harga acuan", false, 100),
      num("diferensialHarga", "Diferensial harga"),
      num("hargaPenawaran", "Harga penawaran", 0),
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
  create(
    "verifikasi",
    "Simpan verifikasi vendor",
    "evaluasi_negosiasi",
    api.transaksiControllerCreateVerifikasi,
    [vendor(true), ...["legalitas", "kewenangan", "rekening", "kepatuhan", "hasil"].map((name) => select(name, name, statuses)), text("catatan", "Catatan")],
    ["admin", "verifikator"],
  ),
  create("negosiasi", "Catat negosiasi", "evaluasi_negosiasi", api.transaksiControllerCreateNegosiasi, [
    rel("penawaranId", "Penawaran", "penawaran", true),
    num("putaran", "Putaran", 1, true, true),
    num("batasNegosiasi", "Batas negosiasi"),
    text("hargaAcuan", "Harga acuan"),
    num("alphaAwal", "Alpha awal"),
    num("alphaAkhir", "Alpha akhir"),
    num("totalBiayaPerolehan", "Total biaya perolehan"),
    text("hasil", "Hasil"),
  ]),
  {
    ...create(
      "memorandum",
      "Simpan memorandum",
      "approval",
      api.transaksiControllerCreateMemorandum,
      [
        select("metodeSeleksi", "Metode seleksi", methods),
        detailText("hasilEvaluasiRingkasan", "Ringkasan hasil evaluasi", "hasilEvaluasi.ringkasan", true),
        detailText("hasilEvaluasiTeknis", "Evaluasi teknis", "hasilEvaluasi.teknis"),
        detailText("hasilEvaluasiAdministratif", "Evaluasi administratif", "hasilEvaluasi.administratif"),
        detailText("analisisHargaRingkasan", "Ringkasan analisis harga", "analisisHarga.ringkasan", true),
        detailText("analisisHargaPembanding", "Harga pembanding dan dasar perhitungan", "analisisHarga.pembanding"),
        text("rekomendasi", "Rekomendasi", true),
        vendor(false, "rekomendasiVendorId"),
        detailText("analisisRisikoRingkasan", "Risiko dan mitigasi", "analisisRisiko.ringkasan"),
        detailText("kesiapanPembiayaanRingkasan", "Kesiapan pembiayaan", "kesiapanPembiayaan.ringkasan"),
      ],
      AO,
      "memorandum",
    ),
    available: (d) => !d.memorandum || ["draft", "revisi"].includes(String((d.memorandum as Entity).status)),
  },
  {
    key: "submit-memorandum",
    title: "Ajukan memorandum",
    stages: ["approval"],
    roles: AO,
    fields: [],
    available: (d) => !!d.memorandum && ["draft", "revisi"].includes(String((d.memorandum as Entity).status)),
    run: (id) => browserApi.approval.approvalActionControllerSubmitMemorandum(id, { format: "json" }),
  },
  create("kontrak", "Buat kontrak", "kontrak", api.transaksiControllerCreateKontrak, [
    nomor,
    text("jenis", "Jenis (penyedia / kerja_sama_penerima_pasokan)", true, 50),
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
    date("mulaiBerlaku", "Mulai berlaku"),
    date("berakhirPada", "Berakhir pada"),
  ]),
  create("adendum", "Buat adendum", "kontrak", api.transaksiControllerCreateAdendum, [rel("kontrakId", "Kontrak", "kontrak", true), nomor, text("alasan", "Alasan", true), json("perubahan", "Perubahan", true)]),
  entityStatus("status-kontrak", "Ubah status kontrak", "kontrak", "kontrak", ["aktif", "selesai"], api.transaksiControllerUpdateStatusKontrak, [...AO, "pimpinan"]),
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
    [nomor, num("nilai", "Nilai", 0, true), rel("tagihanId", "Tagihan", "tagihan"), currency, text("rekeningTujuan", "Rekening tujuan", false, 100)],
    [...AO, "pimpinan"],
  ),
  operationalUpdate("status-tagihan", "Ubah status / tanggal tagihan", "settlement", "tagihan", [select("status", "Status", invoiceStatuses), date("jatuhTempo", "Jatuh tempo"), date("diterbitkanPada", "Diterbitkan pada")]),
  operationalUpdate("status-pembayaran", "Ubah status / tanggal pembayaran", "settlement", "pembayaran", [select("status", "Status", statuses), date("dibayarPada", "Dibayar pada (status selesai)")], [...AO, "pimpinan"]),
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
    const value = (values[field.name] ?? "").trim();
    if (!value) {
      if (field.required) throw new Error(`${field.label} wajib diisi.`);
      continue;
    }
    if (field.maxLength && value.length > field.maxLength) throw new Error(`${field.label}: maksimal ${field.maxLength} karakter.`);
    if (field.relation && !options(field).some((item) => item.value === value)) throw new Error(`${field.label}: pilih relasi yang tersedia.`);
    if (field.options && !field.options.includes(value)) throw new Error(`${field.label}: pilihan tidak valid.`);
    if (field.payloadPath) {
      const target = field.payloadPath.split(".").reduce<Entity>((node, key) => {
        const child = node[key];
        if (!child || typeof child !== "object" || Array.isArray(child)) node[key] = {};
        return node[key] as Entity;
      }, body);
      target[field.payloadPath.split(".").at(-1)!] = value;
    } else if (field.kind === "number") {
      const number = Number(value);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !Number.isFinite(number) || (field.integer && !Number.isInteger(number)) || (field.min !== undefined && number < field.min))
        throw new Error(`${field.label}: angka harus valid${field.integer ? ", bulat" : ""}${field.min !== undefined ? `, minimum ${field.min}` : ""}.`);
      body[field.name] = number;
    } else if (field.kind === "json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        throw new Error(`${field.label}: JSON tidak valid.`);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${field.label}: wajib objek JSON, bukan array/null.`);
      body[field.name] = parsed;
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
