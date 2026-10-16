/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface LoginDto {
  /** @example "admin@lemigas.esdm.go.id" */
  email: string;
  /** @example "password123" */
  password: string;
}

export interface CreateVendorDto {
  /** Nama vendor / perusahaan */
  nama: string;
  /** Alamat lengkap */
  alamat?: string;
  /** Nomor telepon */
  telepon?: string;
  /** Email vendor */
  email?: string;
  /** NPWP */
  npwp?: string;
  /** Nama contact person */
  contactPerson?: string;
  /** @default "aktif" */
  status?: "aktif" | "nonaktif";
  /** Nama akun login vendor */
  akunNama?: string;
  /** Email akun login vendor */
  akunEmail?: string;
  /** Password akun login vendor */
  akunPassword?: string;
}

export interface UpdateVendorDto {
  /** Nama vendor / perusahaan */
  nama?: string;
  /** Alamat lengkap */
  alamat?: string;
  /** Nomor telepon */
  telepon?: string;
  /** Email vendor */
  email?: string;
  /** NPWP */
  npwp?: string;
  /** Nama contact person */
  contactPerson?: string;
  status?: "aktif" | "nonaktif";
}

export interface CreateVendorAccountDto {
  vendorId?: string;
  namaPerusahaan?: string;
  email: string;
  password: string;
  namaPengguna: string;
}

export interface SubmitVendorProfileDto {
  alamat?: string;
  telepon?: string;
  email?: string;
  npwp?: string;
  contactPerson?: string;
}

export interface ReviewVendorOnboardingDto {
  status: "approved" | "rejected" | "requires_revision";
  rejectionReason?: string;
  revision?: object;
}

export interface CreateKategoriDto {
  /**
   * Kode kategori (unik)
   * @example "OIL"
   */
  kode: string;
  /** Nama kategori */
  nama: string;
}

export interface UpdateKategoriDto {
  /** Kode kategori (unik) */
  kode?: string;
  /** Nama kategori */
  nama?: string;
}

export interface CreateBarangDto {
  /** Nama barang */
  nama: string;
  /** Spesifikasi barang */
  spesifikasi?: string;
  /**
   * Satuan (pcs, kg, liter, dll)
   * @example "kg"
   */
  satuan: string;
  /** UUID Kategori Pengadaan */
  kategoriId: string;
  /** Harga estimasi per satuan */
  hargaEstimasi?: number;
}

export interface UpdateBarangDto {
  /** Nama barang */
  nama?: string;
  /** Spesifikasi barang */
  spesifikasi?: string;
  /** Satuan */
  satuan?: string;
  /** UUID Kategori Pengadaan */
  kategoriId?: string;
  /** Harga estimasi per satuan */
  hargaEstimasi?: number;
}

export interface PengadaanItemDto {
  /** UUID Barang */
  barangId: string;
  /** UUID Vendor */
  vendorId?: string;
  /** Jumlah / quantity */
  jumlah: number;
  /** Harga satuan */
  hargaSatuan?: number;
  /** Catatan item */
  catatan?: string;
}

export interface CreatePengadaanDto {
  /** Judul pengadaan */
  judul: string;
  /** Deskripsi pengadaan */
  deskripsi?: string;
  /** Metode pengadaan */
  metode: "tender" | "pengadaan_langsung" | "penunjukan_langsung" | "e_procurement";
  /** @default "sedang" */
  prioritas?: "rendah" | "sedang" | "tinggi" | "darurat";
  /** Tanggal pengajuan (YYYY-MM-DD) */
  tanggalPengajuan?: string;
  /** Tanggal deadline (YYYY-MM-DD) */
  tanggalDeadline?: string;
  /** Unit kerja */
  unitKerja?: string;
  /** Item barang */
  items: PengadaanItemDto[];
}

export interface UpdatePengadaanDto {
  /** Judul pengadaan */
  judul?: string;
  /** Deskripsi pengadaan */
  deskripsi?: string;
  metode?: "tender" | "pengadaan_langsung" | "penunjukan_langsung" | "e_procurement";
  prioritas?: "rendah" | "sedang" | "tinggi" | "darurat";
  /** Tanggal pengajuan (YYYY-MM-DD) */
  tanggalPengajuan?: string;
  /** Tanggal deadline (YYYY-MM-DD) */
  tanggalDeadline?: string;
  /** Unit kerja */
  unitKerja?: string;
  /** Item barang (replace) */
  items?: PengadaanItemDto[];
}

export interface CreatePerencanaanDto {
  modelPelaksanaan: "pengelolaan_manajemen_impor" | "pelaksanaan_impor_langsung";
  jenisKargo: string;
  satuan: string;
  titikSerah: string;
  nomorPenugasan?: string;
  spesifikasiMutu?: object;
  volumeMin?: number;
  volumeMax?: number;
  estimasiMulai?: string;
  estimasiSelesai?: string;
  penerimaPasokan?: string;
  kesiapanPenerima?: object;
}

export interface CreateStrategiDto {
  /** spot, berjangka, atau bentuk strategi lain */
  jenisTransaksi: string;
  metodeSeleksi: "tender" | "pengadaan_langsung" | "penunjukan_langsung" | "e_procurement";
  analisisPasar?: object;
  dasarPemilihan?: string;
  strategiPengiriman?: string;
  strategiPembiayaan?: string;
}

export interface CreateRfqDto {
  vendorId: string;
  nomor: string;
  batasRespons?: string;
  ketentuan?: object;
}

export interface CreatePenawaranDto {
  vendorId?: string;
  nomorRfq?: string;
  hargaAcuan?: string;
  diferensialHarga?: number;
  hargaPenawaran?: number;
  mataUang?: string;
  berlakuSampai?: string;
  ketentuanPengangkutan?: string;
  syaratPembayaran?: string;
  detail?: object;
}

export interface CreateVerifikasiDto {
  vendorId: string;
  legalitas: "draft" | "menunggu_persetujuan" | "aktif" | "selesai" | "revisi" | "ditolak" | "gagal" | "dibatalkan";
  kewenangan: "draft" | "menunggu_persetujuan" | "aktif" | "selesai" | "revisi" | "ditolak" | "gagal" | "dibatalkan";
  rekening: "draft" | "menunggu_persetujuan" | "aktif" | "selesai" | "revisi" | "ditolak" | "gagal" | "dibatalkan";
  kepatuhan: "draft" | "menunggu_persetujuan" | "aktif" | "selesai" | "revisi" | "ditolak" | "gagal" | "dibatalkan";
  hasil: "draft" | "menunggu_persetujuan" | "aktif" | "selesai" | "revisi" | "ditolak" | "gagal" | "dibatalkan";
  catatan?: string;
}

export interface CreateNegosiasiDto {
  penawaranId: string;
  /** Nomor putaran negosiasi */
  putaran: number;
  batasNegosiasi?: number;
  hargaAcuan?: string;
  alphaAwal?: number;
  alphaAkhir?: number;
  totalBiayaPerolehan?: number;
  hasil?: string;
}

export interface CreateMemorandumDto {
  metodeSeleksi: "tender" | "pengadaan_langsung" | "penunjukan_langsung" | "e_procurement";
  hasilEvaluasi: object;
  analisisHarga: object;
  rekomendasi: string;
  rekomendasiVendorId?: string;
  analisisRisiko?: object;
  kesiapanPembiayaan?: object;
}

export interface CreateKontrakDto {
  nomor: string;
  /** penyedia atau kerja_sama_penerima_pasokan */
  jenis: string;
  jenisHarga: "harga_tetap" | "formula_harga" | "lainnya";
  vendorId?: string;
  nilai?: number;
  mataUang?: string;
  formulaHarga?: string;
  ketentuanPembayaran?: string;
  titikSerah?: string;
  pengalihanRisiko?: string;
  forceMajeure?: string;
  hukumBerlaku?: string;
}

export interface UpdateStatusTahapDto {
  status: "draft" | "menunggu_persetujuan" | "aktif" | "selesai" | "revisi" | "ditolak" | "gagal" | "dibatalkan";
}

export interface CreateAdendumDto {
  kontrakId: string;
  nomor: string;
  alasan: string;
  perubahan: object;
}

export interface CreateDokumenOperasionalDto {
  /** BOL, insurance, customs, import_permit, LC, atau dokumen operasi lain */
  jenis: string;
  filePath: string;
  pengirimanId?: string;
  nomor?: string;
  berlakuSampai?: string;
}

export interface CreatePengirimanDto {
  kontrakId?: string;
  namaKapal?: string;
  nomorBillOfLading?: string;
  pelabuhanMuat?: string;
  pelabuhanBongkar?: string;
  etd?: string;
  eta?: string;
  volumeKontrak?: number;
}

export interface CreatePemeriksaanDto {
  pengirimanId: string;
  /** quantity, quality, atau gabungan */
  tipe: string;
  tanggalPeriksa: string;
  surveyor?: string;
  hasilKuantitas?: number;
  hasilMutu?: object;
  nomorSertifikat?: string;
  diterimaDenganCatatan?: boolean;
  catatan?: string;
}

export interface CreatePenerimaanDto {
  pengirimanId: string;
  tanggalTerima: string;
  titikSerah: string;
  nomorBast?: string;
  kuantitasDiterima?: number;
  mutuDiterima?: object;
  denganCatatan?: boolean;
  catatan?: string;
}

export interface CreatePenyimpananDto {
  fasilitas: string;
  satuan: string;
  lokasi?: string;
  kuantitasMasuk?: number;
  kuantitasKeluar?: number;
  catatan?: string;
}

export interface CreateRisikoDto {
  kategori: string;
  deskripsi: string;
  tingkat: "rendah" | "sedang" | "tinggi" | "kritis";
  mitigasi?: string;
}

export interface CreateTagihanDto {
  nomor: string;
  pihak: string;
  /** masuk atau keluar */
  arah: string;
  nilai: number;
  kontrakId?: string;
  mataUang?: string;
  jatuhTempo?: string;
}

export interface CreatePembayaranDto {
  nomor: string;
  nilai: number;
  tagihanId?: string;
  mataUang?: string;
  rekeningTujuan?: string;
}

export interface CreateRekonsiliasiDto {
  selisihVolume?: number;
  selisihNilai?: number;
  mataUang?: string;
  klaim?: object;
  beritaAcara?: string;
}

export interface CreateKlaimDto {
  nomor: string;
  kategori: string;
  uraian: string;
  nilai?: number;
  mataUang?: string;
}

export interface PenuhiDokumenTahapDto {
  tahap: "perencanaan" | "sourcing" | "evaluasi_negosiasi" | "approval" | "kontrak" | "delivery" | "settlement" | "selesai" | "gagal" | "dibatalkan";
  jenisDokumen: string;
  dokumenId: string;
  catatan?: string;
}

export interface CreateLaporanTransaksiDto {
  /** periodik, akhir, atau evaluasi */
  jenis: string;
  ringkasan: string;
  periodeMulai?: string;
  periodeSelesai?: string;
  evaluasi?: object;
  rekomendasi?: string;
}

export interface UpdateTahapDto {
  status: "draft" | "menunggu_persetujuan" | "aktif" | "selesai" | "revisi" | "ditolak" | "gagal" | "dibatalkan";
  tahap: "perencanaan" | "sourcing" | "evaluasi_negosiasi" | "approval" | "kontrak" | "delivery" | "settlement" | "selesai" | "gagal" | "dibatalkan";
  catatan?: string;
}

export interface DecisionDto {
  /** Keputusan approval */
  decision: "disetujui" | "ditolak";
  /** Catatan keputusan */
  catatan?: string;
}

export interface CreateUserDto {
  /** Nama lengkap */
  nama: string;
  /** Email (unik) */
  email: string;
  /** Password minimal 6 karakter */
  password: string;
  /** UUID Role */
  roleId: string;
  /** Unit kerja */
  unitKerja?: string;
  /** UUID vendor untuk akun role VENDOR */
  vendorId?: string;
  /** @default "aktif" */
  status?: "aktif" | "nonaktif";
}

export interface UpdateUserDto {
  /** Nama lengkap */
  nama?: string;
  /** Email */
  email?: string;
  /** Password baru */
  password?: string;
  /** UUID Role */
  roleId?: string;
  /** Unit kerja */
  unitKerja?: string;
  /** UUID vendor untuk akun role VENDOR */
  vendorId?: string;
  status?: "aktif" | "nonaktif";
}

export interface CreateRencanaTransaksiDto {
  judul: string;
  modelPelaksanaan: "pengelolaan_manajemen_impor" | "pelaksanaan_impor_langsung";
  jenisKargo: string;
  satuan: string;
  titikSerah: string;
  jenisTransaksi: string;
  metodeSeleksi: "tender" | "pengadaan_langsung" | "penunjukan_langsung" | "e_procurement";
  deskripsi?: string;
  spesifikasiMutu?: object;
  volumeMin?: number;
  volumeMax?: number;
  estimasiMulai?: string;
  estimasiSelesai?: string;
  penerimaPasokan?: string;
  kesiapanPenerima?: object;
  analisisPasar?: object;
  dasarPemilihan?: string;
  strategiPengiriman?: string;
  strategiPembiayaan?: string;
}

export interface DecisionRencanaDto {
  decision: "disetujui" | "ditolak";
  catatan?: string;
}

export interface GeneratePengadaanDto {
  prioritas: "rendah" | "sedang" | "tinggi" | "darurat";
  unitKerja?: string;
}

export type QueryParamsType = Record<string | number, any>;
export type ResponseFormat = keyof Omit<Body, "body" | "bodyUsed">;

export interface FullRequestParams extends Omit<RequestInit, "body"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseFormat;
  /** request body */
  body?: unknown;
  /** base url */
  baseUrl?: string;
  /** request cancellation token */
  cancelToken?: CancelToken;
}

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> {
  baseUrl?: string;
  baseApiParams?: Omit<RequestParams, "baseUrl" | "cancelToken" | "signal">;
  securityWorker?: (securityData: SecurityDataType | null) => Promise<RequestParams | void> | RequestParams | void;
  customFetch?: typeof fetch;
}

export interface HttpResponse<D extends unknown, E extends unknown = unknown> extends Response {
  data: D;
  error: E;
}

type CancelToken = Symbol | string | number;

export enum ContentType {
  Json = "application/json",
  JsonApi = "application/vnd.api+json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
  Text = "text/plain",
}

export class HttpClient<SecurityDataType = unknown> {
  public baseUrl: string = "";
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private abortControllers = new Map<CancelToken, AbortController>();
  private customFetch = (...fetchParams: Parameters<typeof fetch>) => fetch(...fetchParams);

  private baseApiParams: RequestParams = {
    credentials: "same-origin",
    headers: {},
    redirect: "follow",
    referrerPolicy: "no-referrer",
  };

  constructor(apiConfig: ApiConfig<SecurityDataType> = {}) {
    Object.assign(this, apiConfig);
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  protected encodeQueryParam(key: string, value: any) {
    const encodedKey = encodeURIComponent(key);
    return `${encodedKey}=${encodeURIComponent(typeof value === "number" ? value : `${value}`)}`;
  }

  protected addQueryParam(query: QueryParamsType, key: string) {
    return this.encodeQueryParam(key, query[key]);
  }

  protected addArrayQueryParam(query: QueryParamsType, key: string) {
    const value = query[key];
    return value.map((v: any) => this.encodeQueryParam(key, v)).join("&");
  }

  protected toQueryString(rawQuery?: QueryParamsType): string {
    const query = rawQuery || {};
    const keys = Object.keys(query).filter((key) => "undefined" !== typeof query[key]);
    return keys.map((key) => (Array.isArray(query[key]) ? this.addArrayQueryParam(query, key) : this.addQueryParam(query, key))).join("&");
  }

  protected addQueryParams(rawQuery?: QueryParamsType): string {
    const queryString = this.toQueryString(rawQuery);
    return queryString ? `?${queryString}` : "";
  }

  private contentFormatters: Record<ContentType, (input: any) => any> = {
    [ContentType.Json]: (input: any) => (input !== null && (typeof input === "object" || typeof input === "string") ? JSON.stringify(input) : input),
    [ContentType.JsonApi]: (input: any) => (input !== null && (typeof input === "object" || typeof input === "string") ? JSON.stringify(input) : input),
    [ContentType.Text]: (input: any) => (input !== null && typeof input !== "string" ? JSON.stringify(input) : input),
    [ContentType.FormData]: (input: any) => {
      if (input instanceof FormData) {
        return input;
      }

      return Object.keys(input || {}).reduce((formData, key) => {
        const property = input[key];
        formData.append(key, property instanceof Blob ? property : typeof property === "object" && property !== null ? JSON.stringify(property) : `${property}`);
        return formData;
      }, new FormData());
    },
    [ContentType.UrlEncoded]: (input: any) => this.toQueryString(input),
  };

  protected mergeRequestParams(params1: RequestParams, params2?: RequestParams): RequestParams {
    return {
      ...this.baseApiParams,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.baseApiParams.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  protected createAbortSignal = (cancelToken: CancelToken): AbortSignal | undefined => {
    if (this.abortControllers.has(cancelToken)) {
      const abortController = this.abortControllers.get(cancelToken);
      if (abortController) {
        return abortController.signal;
      }
      return void 0;
    }

    const abortController = new AbortController();
    this.abortControllers.set(cancelToken, abortController);
    return abortController.signal;
  };

  public abortRequest = (cancelToken: CancelToken) => {
    const abortController = this.abortControllers.get(cancelToken);

    if (abortController) {
      abortController.abort();
      this.abortControllers.delete(cancelToken);
    }
  };

  public request = async <T = any, E = any>({ body, secure, path, type, query, format, baseUrl, cancelToken, ...params }: FullRequestParams): Promise<HttpResponse<T, E>> => {
    const secureParams = ((typeof secure === "boolean" ? secure : this.baseApiParams.secure) && this.securityWorker && (await this.securityWorker(this.securityData))) || {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const queryString = query && this.toQueryString(query);
    const payloadFormatter = this.contentFormatters[type || ContentType.Json];
    const responseFormat = format || requestParams.format;

    return this.customFetch(`${baseUrl || this.baseUrl || ""}${path}${queryString ? `?${queryString}` : ""}`, {
      ...requestParams,
      headers: {
        ...(requestParams.headers || {}),
        ...(type && type !== ContentType.FormData ? { "Content-Type": type } : {}),
      },
      signal: (cancelToken ? this.createAbortSignal(cancelToken) : requestParams.signal) || null,
      body: typeof body === "undefined" || body === null ? null : payloadFormatter(body),
    }).then(async (response) => {
      const r = response as HttpResponse<T, E>;
      r.data = null as unknown as T;
      r.error = null as unknown as E;

      const responseToParse = responseFormat ? response.clone() : response;
      const data = !responseFormat
        ? r
        : await responseToParse[responseFormat]()
            .then((data) => {
              if (r.ok) {
                r.data = data;
              } else {
                r.error = data;
              }
              return r;
            })
            .catch((e) => {
              r.error = e;
              return r;
            });

      if (cancelToken) {
        this.abortControllers.delete(cancelToken);
      }

      if (!response.ok) throw data;
      return data;
    });
  };
}

/**
 * @title Pengadaan Minyak API
 * @version 1.0
 * @contact
 *
 * Dokumentasi API untuk aplikasi Pengadaan Minyak LEMIGAS
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  app = {
    /**
     * No description
     *
     * @tags App
     * @name AppControllerGetHello
     * @request GET:/
     */
    appControllerGetHello: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/`,
        method: "GET",
        ...params,
      }),
  };
  health = {
    /**
     * No description
     *
     * @tags Health
     * @name HealthCheck
     * @summary api health check
     * @request GET:/api/health
     */
    healthCheck: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/health`,
        method: "GET",
        ...params,
      }),
  };
  auth = {
    /**
     * No description
     *
     * @tags Auth
     * @name LoginUser
     * @summary Login user dan dapatkan JWT token
     * @request POST:/api/auth/login
     */
    loginUser: (data: LoginDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/login`,
        method: "POST",
        body: data,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Auth
     * @name GetCurrentUser
     * @summary Dapatkan data user dari token JWT
     * @request GET:/api/auth/me
     * @secure
     */
    getCurrentUser: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/auth/me`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  vendor = {
    /**
     * No description
     *
     * @tags Vendor
     * @name VendorGetControllerFindAll
     * @summary Ambil daftar vendor (paginasi + pencarian)
     * @request GET:/api/vendor
     * @secure
     */
    vendorGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter status vendor */
        status?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/vendor`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor
     * @name VendorPostControllerCreate
     * @summary Tambah vendor baru (Admin, Operator)
     * @request POST:/api/vendor
     * @secure
     */
    vendorPostControllerCreate: (data: CreateVendorDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor
     * @name VendorGetControllerFindOne
     * @summary Ambil detail vendor berdasarkan ID
     * @request GET:/api/vendor/{id}
     * @secure
     */
    vendorGetControllerFindOne: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor
     * @name VendorPutControllerUpdate
     * @summary Update vendor (Admin, Operator)
     * @request PUT:/api/vendor/{id}
     * @secure
     */
    vendorPutControllerUpdate: (id: string, data: UpdateVendorDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor
     * @name VendorDeleteControllerRemove
     * @summary Hapus vendor (Admin)
     * @request DELETE:/api/vendor/{id}
     * @secure
     */
    vendorDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  vendorOnboarding = {
    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerCreateAccount
     * @summary Admin membuat akun vendor (Admin)
     * @request POST:/api/vendor-onboarding/accounts
     * @secure
     */
    vendorOnboardingControllerCreateAccount: (data: CreateVendorAccountDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/accounts`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerList
     * @summary Daftar onboarding vendor (Admin, Verifikator)
     * @request GET:/api/vendor-onboarding
     * @secure
     */
    vendorOnboardingControllerList: (
      query: {
        status: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerMyRfqs
     * @summary Daftar RFQ untuk akun vendor (Vendor)
     * @request GET:/api/vendor-onboarding/me/rfqs
     * @secure
     */
    vendorOnboardingControllerMyRfqs: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/me/rfqs`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerMine
     * @summary Status onboarding akun vendor (Vendor)
     * @request GET:/api/vendor-onboarding/me
     * @secure
     */
    vendorOnboardingControllerMine: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/me`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerUpdateProfile
     * @summary Lengkapi profil vendor (Vendor)
     * @request PUT:/api/vendor-onboarding/me/profile
     * @secure
     */
    vendorOnboardingControllerUpdateProfile: (data: SubmitVendorProfileDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/me/profile`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerAddDocument
     * @summary Tambahkan dokumen legalitas vendor (Vendor)
     * @request POST:/api/vendor-onboarding/me/documents
     * @secure
     */
    vendorOnboardingControllerAddDocument: (
      data: {
        /** @format binary */
        file: File;
        jenis: string;
        /** @format date-time */
        expiresAt?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/me/documents`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerDownloadDocument
     * @summary Unduh dokumen onboarding vendor (Admin, Verifikator, Vendor)
     * @request GET:/api/vendor-onboarding/documents/{id}/file
     * @secure
     */
    vendorOnboardingControllerDownloadDocument: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/documents/${id}/file`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerSubmit
     * @summary Ajukan onboarding untuk direview (Vendor)
     * @request POST:/api/vendor-onboarding/me/submit
     * @secure
     */
    vendorOnboardingControllerSubmit: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/me/submit`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Vendor Onboarding
     * @name VendorOnboardingControllerReview
     * @summary Review onboarding vendor (Admin, Verifikator)
     * @request PUT:/api/vendor-onboarding/{id}/review
     * @secure
     */
    vendorOnboardingControllerReview: (id: string, data: ReviewVendorOnboardingDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/vendor-onboarding/${id}/review`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  kategoriPengadaan = {
    /**
     * No description
     *
     * @tags Kategori Pengadaan
     * @name KategoriGetControllerFindAll
     * @summary Ambil daftar kategori pengadaan
     * @request GET:/api/kategori
     * @secure
     */
    kategoriGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/kategori`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Kategori Pengadaan
     * @name KategoriPostControllerCreate
     * @summary Tambah kategori baru (Admin)
     * @request POST:/api/kategori
     * @secure
     */
    kategoriPostControllerCreate: (data: CreateKategoriDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/kategori`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Kategori Pengadaan
     * @name KategoriPutControllerUpdate
     * @summary Update kategori (Admin)
     * @request PUT:/api/kategori/{id}
     * @secure
     */
    kategoriPutControllerUpdate: (id: string, data: UpdateKategoriDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/kategori/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Kategori Pengadaan
     * @name KategoriDeleteControllerRemove
     * @summary Hapus kategori (Admin)
     * @request DELETE:/api/kategori/{id}
     * @secure
     */
    kategoriDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/kategori/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  barang = {
    /**
     * No description
     *
     * @tags Barang
     * @name BarangGetControllerFindAll
     * @summary Ambil daftar barang (paginasi + filter)
     * @request GET:/api/barang
     * @secure
     */
    barangGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter by kategori ID */
        kategoriId?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/barang`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Barang
     * @name BarangPostControllerCreate
     * @summary Tambah barang baru (Admin, Operator)
     * @request POST:/api/barang
     * @secure
     */
    barangPostControllerCreate: (data: CreateBarangDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/barang`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Barang
     * @name BarangGetControllerFindOne
     * @summary Ambil detail barang berdasarkan ID
     * @request GET:/api/barang/{id}
     * @secure
     */
    barangGetControllerFindOne: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/barang/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Barang
     * @name BarangPutControllerUpdate
     * @summary Update barang (Admin, Operator)
     * @request PUT:/api/barang/{id}
     * @secure
     */
    barangPutControllerUpdate: (id: string, data: UpdateBarangDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/barang/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Barang
     * @name BarangDeleteControllerRemove
     * @summary Hapus barang (Admin)
     * @request DELETE:/api/barang/{id}
     * @secure
     */
    barangDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/barang/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  pengadaan = {
    /**
     * No description
     *
     * @tags Pengadaan
     * @name PengadaanGetControllerFindAll
     * @summary Ambil daftar pengadaan (paginasi + filter)
     * @request GET:/api/pengadaan
     * @secure
     */
    pengadaanGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        status?: "draft" | "diajukan" | "dalam_review" | "disetujui" | "ditolak" | "revisi" | "sedang_proses" | "selesai" | "dibatalkan";
        metode?: "tender" | "pengadaan_langsung" | "penunjukan_langsung" | "e_procurement";
        prioritas?: "rendah" | "sedang" | "tinggi" | "darurat";
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/pengadaan`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Pengadaan
     * @name PengadaanPostControllerCreate
     * @summary Buat pengadaan baru (Admin, Operator)
     * @request POST:/api/pengadaan
     * @secure
     */
    pengadaanPostControllerCreate: (data: CreatePengadaanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Pengadaan
     * @name PengadaanGetControllerFindOne
     * @summary Ambil detail pengadaan
     * @request GET:/api/pengadaan/{id}
     * @secure
     */
    pengadaanGetControllerFindOne: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Pengadaan
     * @name PengadaanPutControllerUpdate
     * @summary Update pengadaan (Admin, Operator)
     * @request PUT:/api/pengadaan/{id}
     * @secure
     */
    pengadaanPutControllerUpdate: (id: string, data: UpdatePengadaanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Pengadaan
     * @name PengadaanDeleteControllerRemove
     * @summary Hapus pengadaan (Admin)
     * @request DELETE:/api/pengadaan/{id}
     * @secure
     */
    pengadaanDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  siklusTransaksiKomoditas = {
    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerDetail
     * @summary Detail siklus transaksi komoditas (Admin, Operator, Verifikator, Pimpinan)
     * @request GET:/api/pengadaan/{pengadaanId}/siklus
     * @secure
     */
    transaksiControllerDetail: (pengadaanId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/siklus`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreatePerencanaan
     * @summary Buat perencanaan kebutuhan (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/perencanaan
     * @secure
     */
    transaksiControllerCreatePerencanaan: (pengadaanId: string, data: CreatePerencanaanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/perencanaan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateStrategi
     * @summary Buat strategi transaksi (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/strategi
     * @secure
     */
    transaksiControllerCreateStrategi: (pengadaanId: string, data: CreateStrategiDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/strategi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateRfq
     * @summary Terbitkan RFQ kepada vendor (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/rfq
     * @secure
     */
    transaksiControllerCreateRfq: (pengadaanId: string, data: CreateRfqDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/rfq`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreatePenawaran
     * @summary Catat penawaran vendor (Admin, Operator, Vendor)
     * @request POST:/api/pengadaan/{pengadaanId}/penawaran
     * @secure
     */
    transaksiControllerCreatePenawaran: (pengadaanId: string, data: CreatePenawaranDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/penawaran`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateVerifikasi
     * @summary Verifikasi legalitas dan rekening vendor (Admin, Verifikator)
     * @request POST:/api/pengadaan/{pengadaanId}/verifikasi
     * @secure
     */
    transaksiControllerCreateVerifikasi: (pengadaanId: string, data: CreateVerifikasiDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/verifikasi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateNegosiasi
     * @summary Catat negosiasi transaksi (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/negosiasi
     * @secure
     */
    transaksiControllerCreateNegosiasi: (pengadaanId: string, data: CreateNegosiasiDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/negosiasi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateMemorandum
     * @summary Buat memorandum keputusan transaksi (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/memorandum
     * @secure
     */
    transaksiControllerCreateMemorandum: (pengadaanId: string, data: CreateMemorandumDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/memorandum`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateKontrak
     * @summary Buat kontrak transaksi (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/kontrak
     * @secure
     */
    transaksiControllerCreateKontrak: (pengadaanId: string, data: CreateKontrakDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/kontrak`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerUpdateStatusKontrak
     * @summary Perbarui status kontrak transaksi (Admin, Operator, Pimpinan)
     * @request PUT:/api/pengadaan/{pengadaanId}/kontrak/{kontrakId}/status
     * @secure
     */
    transaksiControllerUpdateStatusKontrak: (pengadaanId: string, kontrakId: string, data: UpdateStatusTahapDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/kontrak/${kontrakId}/status`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateAdendum
     * @summary Buat adendum kontrak (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/adendum
     * @secure
     */
    transaksiControllerCreateAdendum: (pengadaanId: string, data: CreateAdendumDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/adendum`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateDokumenOperasional
     * @summary Catat dokumen impor dan operasi (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/dokumen-operasional
     * @secure
     */
    transaksiControllerCreateDokumenOperasional: (pengadaanId: string, data: CreateDokumenOperasionalDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/dokumen-operasional`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreatePengiriman
     * @summary Catat rencana dan status pengiriman (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/pengiriman
     * @secure
     */
    transaksiControllerCreatePengiriman: (pengadaanId: string, data: CreatePengirimanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/pengiriman`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreatePemeriksaan
     * @summary Catat pemeriksaan kuantitas dan mutu (Admin, Operator, Verifikator)
     * @request POST:/api/pengadaan/{pengadaanId}/pemeriksaan
     * @secure
     */
    transaksiControllerCreatePemeriksaan: (pengadaanId: string, data: CreatePemeriksaanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/pemeriksaan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreatePenerimaan
     * @summary Catat BAST dan penerimaan kargo (Admin, Operator, Verifikator)
     * @request POST:/api/pengadaan/{pengadaanId}/penerimaan
     * @secure
     */
    transaksiControllerCreatePenerimaan: (pengadaanId: string, data: CreatePenerimaanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/penerimaan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreatePenyimpanan
     * @summary Catat penerimaan atau pengeluaran penyimpanan (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/penyimpanan
     * @secure
     */
    transaksiControllerCreatePenyimpanan: (pengadaanId: string, data: CreatePenyimpananDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/penyimpanan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateRisiko
     * @summary Catat risiko atau force majeure (Admin, Operator, Verifikator)
     * @request POST:/api/pengadaan/{pengadaanId}/risiko
     * @secure
     */
    transaksiControllerCreateRisiko: (pengadaanId: string, data: CreateRisikoDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/risiko`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateTagihan
     * @summary Catat tagihan settlement (Admin, Operator)
     * @request POST:/api/pengadaan/{pengadaanId}/tagihan
     * @secure
     */
    transaksiControllerCreateTagihan: (pengadaanId: string, data: CreateTagihanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/tagihan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreatePembayaran
     * @summary Catat pembayaran settlement (Admin, Operator, Pimpinan)
     * @request POST:/api/pengadaan/{pengadaanId}/pembayaran
     * @secure
     */
    transaksiControllerCreatePembayaran: (pengadaanId: string, data: CreatePembayaranDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/pembayaran`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateRekonsiliasi
     * @summary Catat rekonsiliasi transaksi (Admin, Operator, Verifikator)
     * @request POST:/api/pengadaan/{pengadaanId}/rekonsiliasi
     * @secure
     */
    transaksiControllerCreateRekonsiliasi: (pengadaanId: string, data: CreateRekonsiliasiDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/rekonsiliasi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateKlaim
     * @summary Catat klaim dan demurrage (Admin, Operator, Verifikator)
     * @request POST:/api/pengadaan/{pengadaanId}/klaim
     * @secure
     */
    transaksiControllerCreateKlaim: (pengadaanId: string, data: CreateKlaimDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/klaim`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerUpdateStatusKlaim
     * @summary Perbarui status klaim transaksi (Admin, Operator, Verifikator, Pimpinan)
     * @request PUT:/api/pengadaan/{pengadaanId}/klaim/{klaimId}/status
     * @secure
     */
    transaksiControllerUpdateStatusKlaim: (pengadaanId: string, klaimId: string, data: UpdateStatusTahapDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/klaim/${klaimId}/status`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerUpdateStatusRekonsiliasi
     * @summary Perbarui status rekonsiliasi transaksi (Admin, Operator, Verifikator, Pimpinan)
     * @request PUT:/api/pengadaan/{pengadaanId}/rekonsiliasi/status
     * @secure
     */
    transaksiControllerUpdateStatusRekonsiliasi: (pengadaanId: string, data: UpdateStatusTahapDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/rekonsiliasi/status`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerPenuhiDokumenTahap
     * @summary Verifikasi dokumen wajib tahap (Admin, Operator, Verifikator)
     * @request POST:/api/pengadaan/{pengadaanId}/persyaratan-dokumen/penuhi
     * @secure
     */
    transaksiControllerPenuhiDokumenTahap: (pengadaanId: string, data: PenuhiDokumenTahapDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/persyaratan-dokumen/penuhi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerCreateLaporan
     * @summary Buat laporan atau evaluasi transaksi (Admin, Operator, Verifikator, Pimpinan)
     * @request POST:/api/pengadaan/{pengadaanId}/laporan
     * @secure
     */
    transaksiControllerCreateLaporan: (pengadaanId: string, data: CreateLaporanTransaksiDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/laporan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerListLaporan
     * @summary Lihat laporan transaksi (Admin, Operator, Verifikator, Pimpinan)
     * @request GET:/api/pengadaan/{pengadaanId}/laporan
     * @secure
     */
    transaksiControllerListLaporan: (pengadaanId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/laporan`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerTerbitkanLaporan
     * @summary Terbitkan laporan transaksi (Admin, Operator, Pimpinan)
     * @request PUT:/api/pengadaan/{pengadaanId}/laporan/{laporanId}/terbitkan
     * @secure
     */
    transaksiControllerTerbitkanLaporan: (pengadaanId: string, laporanId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/laporan/${laporanId}/terbitkan`,
        method: "PUT",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Siklus Transaksi Komoditas
     * @name TransaksiControllerUpdateTahap
     * @summary Perbarui tahap transaksi (Admin, Operator, Pimpinan)
     * @request PUT:/api/pengadaan/{pengadaanId}/tahap
     * @secure
     */
    transaksiControllerUpdateTahap: (pengadaanId: string, data: UpdateTahapDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/pengadaan/${pengadaanId}/tahap`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  approval = {
    /**
     * No description
     *
     * @tags Approval
     * @name ApprovalGetControllerFindAll
     * @summary Daftar pengadaan yang perlu di-approve
     * @request GET:/api/approval
     * @secure
     */
    approvalGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/approval`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Approval
     * @name ApprovalGetControllerFindMyPengadaan
     * @summary Daftar pengadaan yang saya ajukan
     * @request GET:/api/approval/my
     * @secure
     */
    approvalGetControllerFindMyPengadaan: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/approval/my`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Approval
     * @name ApprovalGetControllerFindMemorandum
     * @summary Daftar memorandum yang perlu di-approve
     * @request GET:/api/approval/memorandum
     * @secure
     */
    approvalGetControllerFindMemorandum: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/approval/memorandum`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Approval
     * @name ApprovalGetControllerGetHistory
     * @summary Riwayat approval pengadaan
     * @request GET:/api/approval/history/{pengadaanId}
     * @secure
     */
    approvalGetControllerGetHistory: (pengadaanId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/approval/history/${pengadaanId}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Approval
     * @name ApprovalActionControllerSubmit
     * @summary Ajukan pengadaan untuk approval (Admin, Operator)
     * @request POST:/api/approval/submit/{pengadaanId}
     * @secure
     */
    approvalActionControllerSubmit: (pengadaanId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/approval/submit/${pengadaanId}`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Approval
     * @name ApprovalActionControllerSubmitMemorandum
     * @summary Ajukan memorandum untuk approval (Admin, Operator)
     * @request POST:/api/approval/memorandum/submit/{pengadaanId}
     * @secure
     */
    approvalActionControllerSubmitMemorandum: (pengadaanId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/approval/memorandum/submit/${pengadaanId}`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Approval
     * @name ApprovalActionControllerDecide
     * @summary Proses keputusan approval (Admin, Verifikator, Pimpinan)
     * @request POST:/api/approval/decide/{pengadaanId}/{stepId}
     * @secure
     */
    approvalActionControllerDecide: (pengadaanId: string, stepId: string, data: DecisionDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/approval/decide/${pengadaanId}/${stepId}`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
  dokumen = {
    /**
     * No description
     *
     * @tags Dokumen
     * @name DokumenGetControllerFindAll
     * @summary Ambil daftar dokumen (paginasi)
     * @request GET:/api/dokumen
     * @secure
     */
    dokumenGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dokumen`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Dokumen
     * @name DokumenGetControllerFindOne
     * @summary Ambil detail dokumen
     * @request GET:/api/dokumen/{id}
     * @secure
     */
    dokumenGetControllerFindOne: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/dokumen/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Dokumen
     * @name DokumenDeleteControllerRemove
     * @summary Hapus dokumen (Admin)
     * @request DELETE:/api/dokumen/{id}
     * @secure
     */
    dokumenDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/dokumen/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Dokumen
     * @name DokumenGetControllerFindByPengadaan
     * @summary Ambil dokumen berdasarkan pengadaan
     * @request GET:/api/dokumen/by-pengadaan/{pengadaanId}
     * @secure
     */
    dokumenGetControllerFindByPengadaan: (pengadaanId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/dokumen/by-pengadaan/${pengadaanId}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Dokumen
     * @name DokumenPostControllerUpload
     * @summary Upload dokumen (Admin, Operator)
     * @request POST:/api/dokumen/upload
     * @secure
     */
    dokumenPostControllerUpload: (
      data: {
        /** @format binary */
        file?: File;
        pengadaanId?: string;
        nama?: string;
        tipePenyimpanan?: "upload_lokal" | "link_eksternal";
        tahap?: "perencanaan" | "sourcing" | "evaluasi_negosiasi" | "approval" | "kontrak" | "delivery" | "settlement";
        jenisDokumen?: string;
        /** @format uuid */
        pengirimanId?: string;
        nomorDokumen?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/dokumen/upload`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.FormData,
        ...params,
      }),
  };
  user = {
    /**
     * No description
     *
     * @tags User
     * @name UserGetControllerFindAll
     * @summary Ambil daftar user (paginasi)
     * @request GET:/api/user
     * @secure
     */
    userGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        status?: "aktif" | "nonaktif";
        /** Filter by role ID */
        roleId?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/user`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name UserPostControllerCreate
     * @summary Tambah user baru (Admin)
     * @request POST:/api/user
     * @secure
     */
    userPostControllerCreate: (data: CreateUserDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/user`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name UserGetControllerGetRoles
     * @summary Ambil daftar role
     * @request GET:/api/user/roles
     * @secure
     */
    userGetControllerGetRoles: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/user/roles`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name UserGetControllerFindOne
     * @summary Ambil detail user
     * @request GET:/api/user/{id}
     * @secure
     */
    userGetControllerFindOne: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/user/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name UserPutControllerUpdate
     * @summary Update user (Admin)
     * @request PUT:/api/user/{id}
     * @secure
     */
    userPutControllerUpdate: (id: string, data: UpdateUserDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/user/${id}`,
        method: "PUT",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags User
     * @name UserDeleteControllerRemove
     * @summary Hapus user (Admin)
     * @request DELETE:/api/user/{id}
     * @secure
     */
    userDeleteControllerRemove: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/user/${id}`,
        method: "DELETE",
        secure: true,
        ...params,
      }),
  };
  notifikasi = {
    /**
     * No description
     *
     * @tags Notifikasi
     * @name NotifikasiGetControllerFindAll
     * @summary Ambil daftar notifikasi user
     * @request GET:/api/notifikasi
     * @secure
     */
    notifikasiGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/notifikasi`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Notifikasi
     * @name NotifikasiPutControllerMarkAsRead
     * @summary Tandai notifikasi sudah dibaca
     * @request PUT:/api/notifikasi/{id}/read
     * @secure
     */
    notifikasiPutControllerMarkAsRead: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/notifikasi/${id}/read`,
        method: "PUT",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Notifikasi
     * @name NotifikasiPutControllerMarkAllAsRead
     * @summary Tandai semua notifikasi sudah dibaca
     * @request PUT:/api/notifikasi/read-all
     * @secure
     */
    notifikasiPutControllerMarkAllAsRead: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/notifikasi/read-all`,
        method: "PUT",
        secure: true,
        ...params,
      }),
  };
  auditLog = {
    /**
     * No description
     *
     * @tags Audit Log
     * @name AuditLogGetControllerFindAll
     * @summary Ambil daftar audit log (Admin, Pimpinan)
     * @request GET:/api/audit-log
     * @secure
     */
    auditLogGetControllerFindAll: (
      query?: {
        /** Pencarian / filter bebas */
        query?: string;
        /** @default 10 */
        limit?: number;
        /** @default 1 */
        page?: number;
        /** Filter berdasarkan tabel */
        tabel?: string;
        /** Filter berdasarkan ID record */
        recordId?: string;
        /** Filter berdasarkan aksi (CREATE, UPDATE, DELETE) */
        aksi?: string;
      },
      params: RequestParams = {},
    ) =>
      this.request<void, any>({
        path: `/api/audit-log`,
        method: "GET",
        query: query,
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags Audit Log
     * @name AuditLogGetControllerFindByRecord
     * @summary Audit log untuk record tertentu
     * @request GET:/api/audit-log/by-record/{tabel}/{recordId}
     * @secure
     */
    auditLogGetControllerFindByRecord: (tabel: string, recordId: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/audit-log/by-record/${tabel}/${recordId}`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  dashboard = {
    /**
     * No description
     *
     * @tags Dashboard
     * @name DashboardGetControllerGetStats
     * @summary Statistik dashboard
     * @request GET:/api/dashboard
     * @secure
     */
    dashboardGetControllerGetStats: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/dashboard`,
        method: "GET",
        secure: true,
        ...params,
      }),
  };
  ePlanningTransaksi = {
    /**
     * No description
     *
     * @tags E-Planning Transaksi
     * @name PerencanaanControllerFindAll
     * @summary Daftar rencana transaksi (Admin, Operator, Verifikator, Pimpinan)
     * @request GET:/api/rencana-transaksi
     * @secure
     */
    perencanaanControllerFindAll: (params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/rencana-transaksi`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags E-Planning Transaksi
     * @name PerencanaanControllerCreate
     * @summary Buat rencana transaksi (Admin, Operator)
     * @request POST:/api/rencana-transaksi
     * @secure
     */
    perencanaanControllerCreate: (data: CreateRencanaTransaksiDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/rencana-transaksi`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags E-Planning Transaksi
     * @name PerencanaanControllerDetail
     * @summary Detail rencana transaksi (Admin, Operator, Verifikator, Pimpinan)
     * @request GET:/api/rencana-transaksi/{id}
     * @secure
     */
    perencanaanControllerDetail: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/rencana-transaksi/${id}`,
        method: "GET",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags E-Planning Transaksi
     * @name PerencanaanControllerSubmit
     * @summary Ajukan rencana untuk approval (Admin, Operator)
     * @request POST:/api/rencana-transaksi/{id}/submit
     * @secure
     */
    perencanaanControllerSubmit: (id: string, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/rencana-transaksi/${id}/submit`,
        method: "POST",
        secure: true,
        ...params,
      }),

    /**
     * No description
     *
     * @tags E-Planning Transaksi
     * @name PerencanaanControllerDecide
     * @summary Putuskan approval rencana (Admin, Verifikator, Pimpinan)
     * @request POST:/api/rencana-transaksi/{id}/approval/{stepId}
     * @secure
     */
    perencanaanControllerDecide: (id: string, stepId: string, data: DecisionRencanaDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/rencana-transaksi/${id}/approval/${stepId}`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),

    /**
     * No description
     *
     * @tags E-Planning Transaksi
     * @name PerencanaanControllerGeneratePengadaan
     * @summary Generate pengadaan dari rencana disetujui (Admin, Operator)
     * @request POST:/api/rencana-transaksi/{id}/generate-pengadaan
     * @secure
     */
    perencanaanControllerGeneratePengadaan: (id: string, data: GeneratePengadaanDto, params: RequestParams = {}) =>
      this.request<void, any>({
        path: `/api/rencana-transaksi/${id}/generate-pengadaan`,
        method: "POST",
        body: data,
        secure: true,
        type: ContentType.Json,
        ...params,
      }),
  };
}
