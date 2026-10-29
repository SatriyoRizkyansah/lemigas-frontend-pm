"use client";

import { useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/modal/Modal";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { useUserRoles, useUserWrite, userError, type UserRecord, type UserCommand } from "./user-api";

export default function UserForm({ user, canManage, onClose, onSaved }: { user?: UserRecord; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const roles = useUserRoles();
  const vendors = use_query<{ data: Array<{ id: string; nama: string }> }, Error, Record<string, never>>({
    tag: "vendor",
    method: "vendorGetControllerFindAll",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      const response = await apiData(browserApi.vendor.vendorGetControllerFindAll({ page: 1, limit: 100 }, { format: "json" }) as Promise<{ data: unknown }>);
      let payload = response as any;
      for (let depth = 0; depth < 3 && payload && typeof payload === "object" && "data" in payload; depth += 1) payload = payload.data;
      return { data: Array.isArray(payload) ? payload : [] };
    },
  });
  const write = useUserWrite();
  const lock = useRef(false);
  const [form, setForm] = useState({ nama: user?.nama ?? "", email: user?.email ?? "", password: "", roleId: user?.role.id ?? "", vendorId: user?.vendorId ?? "", unitKerja: user?.unitKerja ?? "", status: user?.status ?? "aktif" });
  const [command, setCommand] = useState<UserCommand | null>(null);
  const [error, setError] = useState("");
  const validRole = roles.isSuccess && roles.data.data.some((role) => role.id === form.roleId);
  const selectedRole = roles.data?.data.find((role) => role.id === form.roleId);
  const isVendorRole = selectedRole?.kode.toUpperCase() === "VENDOR";
  const busy = write.isPending;
  function close() {
    if (!lock.current) onClose();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || lock.current || command) return;
    setError("");
    if (!form.nama.trim() || !form.email.trim() || !validRole || (isVendorRole && !form.vendorId) || (!user && !form.password) || (form.password && form.password.length < 6)) {
      setError(isVendorRole && !form.vendorId ? "Pilih vendor untuk akun role vendor." : "Lengkapi nama, email, role valid, dan password minimal 6 karakter.");
      return;
    }
    const body = {
      nama: form.nama.trim(),
      email: form.email.trim(),
      roleId: form.roleId,
      vendorId: isVendorRole ? form.vendorId : undefined,
      unitKerja: user ? form.unitKerja.trim() : form.unitKerja.trim() || undefined,
      status: form.status,
    };
    setCommand(user ? { kind: "update", id: user.id, body: { ...body, ...(form.password ? { password: form.password } : {}) } } : { kind: "create", body: { ...body, password: form.password } });
  }
  async function confirm() {
    if (!command || !canManage || lock.current || !validRole) return;
    lock.current = true;
    setError("");
    try {
      await write.mutateAsync(command);
      onSaved();
    } catch (failure) {
      setError(userError(failure));
      setCommand(null);
    } finally {
      lock.current = false;
    }
  }
  return (
    <>
      <Modal
        open={canManage}
        onClose={close}
        title={user ? "Ubah pengguna" : "Tambah pengguna"}
        description={user ? "Perbarui informasi akun dan akses pengguna." : "Isi informasi akun dan tentukan akses pengguna."}
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              Batal
            </Button>
            <Button type="submit" form="user-form" disabled={busy || !validRole || (isVendorRole && !form.vendorId) || Boolean(command)}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        <form id="user-form" onSubmit={submit} className="grid gap-4">
          <fieldset disabled={busy || Boolean(command)} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="user-nama">Nama</Label>
              <Input id="user-nama" required maxLength={150} autoComplete="name" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">{user ? "Password baru (opsional)" : "Password"}</Label>
              <Input id="user-password" type="password" required={!user} minLength={6} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-xs">Minimal 6 karakter.{user ? " Kosongkan untuk mempertahankan password." : ""}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role">Peran</Label>
              <FilterCombobox
                id="user-role"
                required
                disabled={!roles.isSuccess}
                label="peran"
                searchPlaceholder="Cari nama atau kode role..."
                emptyLabel={roles.isPending ? "Memuat role..." : "Pilih role"}
                options={(roles.data?.data ?? []).map((role) => ({ value: role.id, label: role.nama + " (" + role.kode + ")" }))}
                value={form.roleId}
                onValueChange={(value) => setForm({ ...form, roleId: value, vendorId: "" })}
              />
              {roles.isError ? (
                <div role="alert">
                  {userError(roles.error)}{" "}
                  <Button type="button" variant="link" disabled={roles.isFetching} onClick={() => void roles.refetch()}>
                    Muat ulang role
                  </Button>
                </div>
              ) : null}
              {roles.isSuccess && !roles.data.data.length ? <p role="alert">Backend belum menyediakan role. Penyimpanan diblokir.</p> : null}
            </div>
            {isVendorRole ? (
              <div className="grid gap-2">
                <Label htmlFor="user-vendor">Vendor</Label>
                <FilterCombobox
                  id="user-vendor"
                  required
                  disabled={!vendors.isSuccess}
                  label="vendor"
                  searchPlaceholder="Cari nama vendor..."
                  emptyLabel={vendors.isPending ? "Memuat vendor..." : "Pilih vendor"}
                  options={(vendors.data?.data ?? []).map((vendor) => ({ value: vendor.id, label: vendor.nama }))}
                  value={form.vendorId}
                  onValueChange={(value) => setForm({ ...form, vendorId: value })}
                />
                {vendors.isError ? (
                  <p role="alert">
                    {userError(vendors.error)}{" "}
                    <Button type="button" variant="link" onClick={() => void vendors.refetch()}>
                      Muat ulang vendor
                    </Button>
                  </p>
                ) : null}
                {vendors.isSuccess && !vendors.data.data.length ? <p role="alert">Belum ada vendor. Buat vendor terlebih dahulu.</p> : null}
              </div>
            ) : null}
            {!isVendorRole ? (
              <div className="grid gap-2">
                <Label htmlFor="user-unit">Unit kerja</Label>
                <Input id="user-unit" maxLength={150} value={form.unitKerja} onChange={(e) => setForm({ ...form, unitKerja: e.target.value })} />
              </div>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="user-status">Status</Label>
              <FilterCombobox
                id="user-status"
                options={[{ value: "aktif", label: "Aktif" }, { value: "nonaktif", label: "Nonaktif" }]}
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as "aktif" | "nonaktif" })}
                label="status"
                searchPlaceholder="Cari status..."
              />
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>
      <ConfirmDialog
        open={Boolean(command) && canManage}
        onClose={() => {
          if (!lock.current) setCommand(null);
        }}
        onConfirm={() => void confirm()}
        busy={busy}
        title={user ? "Simpan perubahan pengguna?" : "Buat pengguna?"}
        confirmLabel="Ya, simpan"
        message={`Data akun ${form.email.trim()}, role, status, dan password yang diisi akan disimpan. Perubahan role atau status dapat mengubah akses pengguna.`}
      />
    </>
  );
}
