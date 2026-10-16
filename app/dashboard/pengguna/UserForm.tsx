"use client";

import { useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/modal/Modal";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserRoles, useUserWrite, userError, type UserRecord, type UserCommand } from "./user-api";

export default function UserForm({ user, canManage, onClose, onSaved }: { user?: UserRecord; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const roles = useUserRoles();
  const write = useUserWrite();
  const lock = useRef(false);
  const [form, setForm] = useState({ nama: user?.nama ?? "", email: user?.email ?? "", password: "", roleId: user?.role.id ?? "", unitKerja: user?.unitKerja ?? "", status: user?.status ?? "aktif" });
  const [command, setCommand] = useState<UserCommand | null>(null);
  const [error, setError] = useState("");
  const validRole = roles.isSuccess && roles.data.data.some((role) => role.id === form.roleId);
  const busy = write.isPending;
  function close() {
    if (!lock.current) onClose();
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || lock.current || command) return;
    setError("");
    if (!form.nama.trim() || !form.email.trim() || !validRole || (!user && !form.password) || (form.password && form.password.length < 6)) {
      setError("Lengkapi nama, email, role valid, dan password minimal 6 karakter.");
      return;
    }
    const body = {
      nama: form.nama.trim(),
      email: form.email.trim(),
      roleId: form.roleId,
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
        footer={
          <>
            <Button type="button" variant="outline" disabled={busy} onClick={close}>
              Batal
            </Button>
            <Button type="submit" form="user-form" disabled={busy || !validRole || Boolean(command)}>
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
              <select id="user-role" required disabled={!roles.isSuccess} className="h-9 w-full rounded-md border bg-background px-3 text-foreground" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                <option value="">{roles.isPending ? "Memuat role…" : "Pilih role"}</option>
                {roles.data?.data.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.nama} ({role.kode})
                  </option>
                ))}
              </select>
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
            <div className="grid gap-2">
              <Label htmlFor="user-unit">Unit kerja</Label>
              <Input id="user-unit" maxLength={150} value={form.unitKerja} onChange={(e) => setForm({ ...form, unitKerja: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-status">Status</Label>
              <select id="user-status" className="h-9 w-full rounded-md border bg-background px-3 text-foreground" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "aktif" | "nonaktif" })}>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
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
