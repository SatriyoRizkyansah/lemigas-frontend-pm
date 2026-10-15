"use client";

import { browserApi } from "./browser-client";
import { use_query } from "./use_query";
import { use_mutation } from "./use_mutation";
import type { LoginDto, RequestParams } from "./generated/api-generated";
import { apiQueryKeys } from "./query-keys";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

export type LoginResponse = {
  id_pegawai: string;
  nama: string;
  foto?: string;
  akses: Array<{ token: string; akses: string }>;
};

export type CurrentUser = {
  id: string;
  email: string;
  nama: string;
  role: string;
  unitKerja?: string;
};

export function setBrowserToken() {
  const cookie =
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split(";")
          .map((item) => item.trim())
          .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
          ?.slice(SESSION_COOKIE.length + 1);
  browserApi.setSecurityData(readSession(cookie)?.token ?? null);
}

export async function apiData<T>(request: Promise<{ data: T }>): Promise<T> {
  return (await request).data;
}

function unwrapApiPayload(value: unknown): unknown {
  let current = value;
  // API wrapper lama kadang membungkus body di data lebih dari sekali.
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current || typeof current !== "object" || !("data" in current)) break;
    const nested = (current as { data?: unknown }).data;
    if (!nested || typeof nested !== "object") break;
    current = nested;
  }
  return current;
}

function parseLoginResponse(value: unknown): LoginResponse {
  const payload = unwrapApiPayload(value) as Partial<LoginResponse> | null;
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.akses)) {
    throw new Error("Server tidak mengirim profil login yang valid. Periksa response POST /api/auth/login.");
  }
  const akses = payload.akses.filter((item): item is { token: string; akses: string } => Boolean(item && typeof item.token === "string" && item.token && typeof item.akses === "string"));
  if (!akses.length) throw new Error("Server login tidak mengirim token akses. Periksa response POST /api/auth/login.");
  return { id_pegawai: payload.id_pegawai ?? "", nama: payload.nama ?? "Pengguna", foto: payload.foto, akses };
}

/** GET /api/health via use_query. */
export function useApiHealth(options: { enabled?: boolean } = {}) {
  return use_query<void, Error, RequestParams>({
    tag: "health",
    method: "healthCheck",
    params: {},
    queryFn: (params) => apiData(browserApi.health.healthCheck({ ...params, format: "json" })),
    ...options,
  });
}

/** GET /api/auth/me via use_query. */
export function useCurrentUser(params: RequestParams = {}, enabled = true) {
  return use_query<CurrentUser, Error, RequestParams>({
    tag: "auth",
    method: "getCurrentUser",
    params,
    queryFn: async (requestParams) => {
      setBrowserToken();
      return apiData(browserApi.auth.getCurrentUser({ ...requestParams, format: "json" }) as unknown as Promise<{ data: CurrentUser }>);
    },
    enabled,
  });
}

/** GET /api/dashboard via use_query. */
export type DashboardStats = {
  status: number;
  message: string;
  data: {
    pengadaan: { total: number; draft: number; diajukan: number; dalam_review: number; disetujui: number; ditolak: number; selesai: number; bulan_ini: number };
    master: { vendor_aktif: number; total_barang: number; user_aktif: number };
    approval_pending: number;
    recent_pengadaan: Array<{ id: string; nomorSurat: string | null; judul: string; status: string; metode: string; prioritas: string; createdAt: string; diajukanOlehUser?: { nama: string } | null }>;
    pengadaan_status: Array<{ status: string; total: number }>;
    tahapan: Array<{ tahap: string; total: number; aktif: number; menunggu_persetujuan: number; selesai: number; revisi: number; ditolak: number }>;
    pengiriman: Array<{ status: string; total: number }>;
    tagihan: Array<{ status: string; mata_uang: string; total: number; nilai: string }>;
    trend_bulanan: Array<{ periode: string; jumlah: number; nilai_estimasi: string }>;
  };
};

export function useDashboardStats(enabled = true) {
  return use_query<DashboardStats, Error, RequestParams>({
    tag: "dashboard",
    method: "getStats",
    params: {},
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.dashboard.dashboardGetControllerGetStats({ ...params, format: "json" }) as unknown as Promise<{ data: DashboardStats }>);
    },
    enabled,
  });
}

/** POST /api/auth/login via use_mutation. */
export function useLoginMutation() {
  return use_mutation<LoginResponse, Error, { data: LoginDto; params?: RequestParams }>({
    tag: "auth",
    method: "loginUser",
    mutationFn: async ({ data, params }) => {
      const response = await apiData(browserApi.auth.loginUser(data, { ...params, format: "json" }) as unknown as Promise<{ data: unknown }>);
      return parseLoginResponse(response);
    },
    invalidateKeys: [apiQueryKeys.resource("auth"), apiQueryKeys.resource("dashboard")],
  });
}
