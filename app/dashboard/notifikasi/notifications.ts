"use client";

import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";

export type Notification = {
  id: string;
  pesan: string;
  tanggalKirim: string;
  sudahDibaca: boolean;
  pengadaan: { id: string; nomorSurat: string | null; judul: string } | null;
};

type NotificationResponse = {
  data: Notification[];
  pagination: { page: number; limit: number; total_datas: number; total_pages: number };
  unread_count: number;
};

// Generated client declares void responses; this local type follows the backend controller.
export function useNotifications(page: number, limit: number) {
  return use_query<NotificationResponse, Error, { page: number; limit: number }>({
    tag: "notifikasi",
    method: "notifikasiGetControllerFindAll",
    params: { page, limit },
    queryFn: async (params) => {
      setBrowserToken();
      const response = await apiData(browserApi.notifikasi.notifikasiGetControllerFindAll(params, { format: "json" }) as unknown as Promise<{ data: NotificationResponse }>);
      if (!Array.isArray(response?.data) || !response.pagination || typeof response.unread_count !== "number") {
        throw new Error("Respons notifikasi tidak valid.");
      }
      return response;
    },
  });
}

export function useMarkNotificationRead() {
  return use_mutation<unknown, Error, string>({
    tag: "notifikasi",
    method: "notifikasiPutControllerMarkAsRead",
    invalidateKeys: [apiQueryKeys.resource("notifikasi")],
    mutationFn: async (id) => {
      setBrowserToken();
      return apiData(browserApi.notifikasi.notifikasiPutControllerMarkAsRead(id, { format: "json" }));
    },
  });
}

export function useMarkAllNotificationsRead() {
  return use_mutation<unknown, Error, void>({
    tag: "notifikasi",
    method: "notifikasiPutControllerMarkAllAsRead",
    invalidateKeys: [apiQueryKeys.resource("notifikasi")],
    mutationFn: async () => {
      setBrowserToken();
      return apiData(browserApi.notifikasi.notifikasiPutControllerMarkAllAsRead({ format: "json" }));
    },
  });
}
