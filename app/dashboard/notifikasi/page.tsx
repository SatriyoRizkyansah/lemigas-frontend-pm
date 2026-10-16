"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { Button } from "@/components/ui/Button";
import { dateText } from "@/components/procurement/EntityListPage";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, type Notification } from "./notifications";

export default function NotifikasiPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const notifications = useNotifications(page, limit);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const readPending = markRead.isPending || markAllRead.isPending;
  const response = notifications.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Notifikasi</h1>
          <p className="text-sm text-muted-foreground">Inbox dan riwayat notifikasi, terbaru terlebih dahulu.</p>
          {response ? (
            <p className="text-sm" aria-live="polite">
              {response.unread_count} belum dibaca · {response.pagination.total_datas} notifikasi
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={readPending || !response?.unread_count}
          onClick={() => {
            markRead.reset();
            markAllRead.mutate();
          }}
        >
          <CheckCheck size={16} /> {markAllRead.isPending ? "Menandai…" : "Tandai semua dibaca"}
        </Button>
      </div>
      {markRead.isError || markAllRead.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Gagal menandai notifikasi. Silakan coba lagi.
        </p>
      ) : null}
      {notifications.isPending ? (
        <p role="status">Memuat notifikasi…</p>
      ) : notifications.isError ? (
        <div role="alert" className="space-y-3">
          <p>Notifikasi gagal dimuat.</p>
          <Button type="button" variant="outline" disabled={notifications.isFetching} onClick={() => void notifications.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : response ? (
        <DataTable<Notification>
          hideSearch
          rows={response.data}
          rowKey={(item) => item.id}
          emptyMessage="Belum ada notifikasi."
          columns={[
            {
              key: "pesan",
              header: "Notifikasi",
              render: (item) => (
                <div className="max-w-xl whitespace-normal">
                  <p className={item.sudahDibaca ? "" : "font-semibold"}>{item.pesan}</p>
                  {item.pengadaan ? (
                    <p className="text-xs text-muted-foreground">
                      {item.pengadaan.nomorSurat ? `${item.pengadaan.nomorSurat} · ` : ""}
                      {item.pengadaan.judul}
                    </p>
                  ) : null}
                </div>
              ),
            },
            { key: "tanggalKirim", header: "Waktu kirim", render: (item) => <time dateTime={item.tanggalKirim}>{dateText(item.tanggalKirim)}</time> },
            { key: "sudahDibaca", header: "Status", render: (item) => (item.sudahDibaca ? "Sudah dibaca" : <span className="font-semibold">Belum dibaca</span>) },
            {
              key: "actions",
              header: "Aksi",
              render: (item) =>
                item.sudahDibaca ? (
                  "—"
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={readPending}
                    aria-label={`Tandai dibaca: ${item.pesan}`}
                    onClick={() => {
                      markAllRead.reset();
                      markRead.mutate(item.id);
                    }}
                  >
                    {markRead.isPending && markRead.variables === item.id ? "Menandai…" : "Tandai dibaca"}
                  </Button>
                ),
            },
          ]}
          pagination={{
            page: response.pagination.page,
            pageSize: response.pagination.limit,
            total: response.pagination.total_datas,
            totalPages: response.pagination.total_pages,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setLimit(size);
              setPage(1);
            },
          }}
        />
      ) : null}
    </div>
  );
}
