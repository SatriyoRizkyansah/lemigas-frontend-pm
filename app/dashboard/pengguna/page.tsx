"use client";

import { useEffect, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/api/hooks";
import { DataTable } from "@/components/table/DataTable";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LoadingState } from "@/components/loading/LoadingState";
import { Modal } from "@/components/modal/Modal";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import UserForm from "./UserForm";
import { useUsers, useUserDetail, useUserWrite, userError, type UserRecord } from "./user-api";

export default function PenggunaPage() {
  const identity = useCurrentUser();
  const canManage = identity.isSuccess && !identity.isRefetchError && identity.data.role.toLowerCase() === "admin";
  const [search, setSearch] = useState("");
  const [params, setParams] = useState({ query: "", page: 1, limit: 10 });
  const [selected, setSelected] = useState<{ id: string; mode: "detail" | "edit" } | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<UserRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const users = useUsers(params);
  const detail = useUserDetail(selected?.id);
  const write = useUserWrite();

  useEffect(() => {
    const timer = window.setTimeout(() => setParams((old) => (old.query === search.trim() ? old : { ...old, query: search.trim(), page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (users.isSuccess && params.page > Math.max(1, users.data.pagination.total_pages)) {
      setParams((old) => ({ ...old, page: Math.max(1, users.data.pagination.total_pages) }));
    }
  }, [users.isSuccess, users.data, params.page]);

  function open(row: UserRecord, mode: "detail" | "edit") {
    if (write.isPending || (mode === "edit" && !canManage)) return;
    setError("");
    setNotice("");
    setSelected({ id: row.id, mode });
  }
  async function deactivate() {
    if (!canManage || !removing || lock.current) return;
    lock.current = true;
    setError("");
    try {
      await write.mutateAsync({ kind: "deactivate", id: removing.id });
      setRemoving(null);
      setNotice("Pengguna berhasil dinonaktifkan. Data tidak dihapus permanen.");
    } catch (failure) {
      setError(userError(failure));
    } finally {
      lock.current = false;
    }
  }
  const columns = [
    { key: "nama", header: "Nama", render: (row: UserRecord) => row.nama },
    { key: "email", header: "Email", render: (row: UserRecord) => row.email },
    { key: "role", header: "Peran", render: (row: UserRecord) => row.role?.nama ?? "—" },
    { key: "unitKerja", header: "Unit kerja", render: (row: UserRecord) => row.unitKerja || "—" },
    { key: "status", header: "Status", render: (row: UserRecord) => <StatusBadge status={row.status === "aktif" ? "ok" : "danger"}>{row.status}</StatusBadge> },
    {
      key: "actions",
      header: "Aksi",
      render: (row: UserRecord) => (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={write.isPending} onClick={() => open(row, "detail")} aria-label={`Detail ${row.nama}`}>
            Detail
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="outline" size="sm" disabled={write.isPending} onClick={() => open(row, "edit")} aria-label={`Ubah ${row.nama}`}>
                Ubah
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={write.isPending || row.status === "nonaktif"}
                onClick={() => {
                  setError("");
                  setNotice("");
                  setRemoving(row);
                }}
                aria-label={`Nonaktifkan ${row.nama}`}
              >
                Nonaktifkan
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <section className="space-y-5 py-1">
      <PageHeader
        title="Pengguna"
        description="Daftar pengguna dan peran sistem. Pengelolaan akun khusus Admin."
        actions={
          canManage ? (
            <Button
              type="button"
              disabled={write.isPending}
              onClick={() => {
                setCreating(true);
                setNotice("");
                setError("");
              }}
            >
              Tambah pengguna
            </Button>
          ) : null
        }
      />
      {identity.isPending ? (
        <p role="status">Memeriksa akses…</p>
      ) : identity.isError ? (
        <p role="alert">
          Akses administrasi belum dapat diverifikasi. {userError(identity.error)}{" "}
          <Button type="button" variant="link" disabled={identity.isFetching} onClick={() => void identity.refetch()}>
            Coba lagi
          </Button>
        </p>
      ) : !canManage ? (
        <p>Mode baca saja. Perubahan akun memerlukan role Admin.</p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {users.isFetching ? <p role="status">Memuat pengguna…</p> : null}
      {users.isPending ? (
        <LoadingState />
      ) : users.isError ? (
        <p role="alert">
          {userError(users.error)}{" "}
          <Button type="button" variant="link" disabled={users.isFetching} onClick={() => void users.refetch()}>
            Coba lagi
          </Button>
        </p>
      ) : (
        <DataTable
          columns={columns}
          rows={users.data.data}
          rowKey={(row) => row.id}
          remoteSearch
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari nama, email, atau unit kerja…"
          emptyMessage="Belum ada pengguna."
          pagination={{
            page: params.page,
            pageSize: params.limit,
            total: users.data.pagination.total_datas,
            totalPages: Math.max(1, users.data.pagination.total_pages),
            onPageChange: (page) => setParams((old) => ({ ...old, page })),
            onPageSizeChange: (limit) => setParams((old) => ({ ...old, limit, page: 1 })),
          }}
        />
      )}
      <Modal open={Boolean(selected) && (selected?.mode === "detail" || !detail.isSuccess)} onClose={() => setSelected(null)} title={selected?.mode === "edit" ? "Memuat data pengguna" : "Detail pengguna"}>
        {detail.isPending || detail.isFetching ? (
          <LoadingState />
        ) : detail.isError ? (
          <p role="alert">
            {userError(detail.error)}{" "}
            <Button type="button" variant="link" disabled={detail.isFetching} onClick={() => void detail.refetch()}>
              Coba lagi
            </Button>
          </p>
        ) : detail.data ? (
          <dl className="divide-y divide-border">
            {Object.entries({
              ID: detail.data.data.id,
              Nama: detail.data.data.nama,
              Email: detail.data.data.email,
              Peran: `${detail.data.data.role.nama} (${detail.data.data.role.kode})`,
              "Unit kerja": detail.data.data.unitKerja || "—",
              Status: detail.data.data.status,
              "Dibuat pada": new Date(detail.data.data.createdAt).toLocaleString("id-ID"),
            }).map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className={`min-w-0 break-words text-sm font-medium text-foreground ${label === "ID" ? "font-mono text-xs" : ""}`}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Modal>
      {creating && canManage ? (
        <UserForm
          canManage={canManage}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setNotice("Pengguna berhasil dibuat.");
          }}
        />
      ) : null}
      {selected?.mode === "edit" && canManage && detail.isSuccess ? (
        <UserForm
          key={selected.id}
          user={detail.data.data}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setNotice("Pengguna berhasil diperbarui.");
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(removing) && canManage}
        onClose={() => {
          if (!lock.current) setRemoving(null);
        }}
        onConfirm={() => void deactivate()}
        busy={write.isPending}
        title="Nonaktifkan pengguna?"
        confirmLabel="Ya, nonaktifkan"
        message={`Akun ${removing?.nama ?? ""} (${removing?.email ?? ""}) akan berstatus nonaktif. Backend tidak menghapus data permanen. Efek pada sesi aktif mengikuti kebijakan backend.`}
      />
    </section>
  );
}
