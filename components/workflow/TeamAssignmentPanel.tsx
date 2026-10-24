"use client";

import { useEffect, useMemo, useState } from "react";
import { UsersRound } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { ContentType } from "@/lib/api/generated/api-generated";
import { setBrowserToken } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { Modal } from "@/components/modal/Modal";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { DataTable } from "@/components/table/DataTable";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Stage = { key: string; label: string; urutan?: number };
type Member = {
  id: string;
  userId: string;
  peran: "pic_utama" | "pic" | "viewer";
  user: { id: string; nama: string; email: string; role?: { kode?: string } };
};
type Assignment = { userId: string; tanggungJawab: string; user: { nama: string; email: string } };
type TeamPayload = { anggota: Member[]; tahapan: Array<{ tahap: string; label?: string | null; assignments: Assignment[] }> };
type UserRecord = { id: string; nama: string; email: string; role?: { kode?: string } };

const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;
const label = (value: string) => value.replaceAll("_", " ");

export function TeamAssignmentPanel({ pengadaanId, stages, canManage }: { pengadaanId: string; stages: Stage[]; canManage: boolean }) {
  const [team, setTeam] = useState<TeamPayload | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [memberOpen, setMemberOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);
  const [userQuery, setUserQuery] = useState("");
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [memberRole, setMemberRole] = useState<"pic_utama" | "pic" | "viewer">("pic");
  const [newMemberStage, setNewMemberStage] = useState("");

  const request = async <T,>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown) => {
    setBrowserToken();
    const response = await browserApi.request<T>({ path, method, body, type: ContentType.Json, secure: true, format: "json" });
    return unwrap(response.data) as T;
  };
  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [teamResult, usersResult] = await Promise.all([
        request<TeamPayload>(`/api/pengadaan/${pengadaanId}/team`, "GET"),
        browserApi.user.userGetControllerFindAll({ status: "aktif", page: 1, limit: 100, query: userQuery || undefined }, { format: "json" }),
      ]);
      setTeam(teamResult);
      const userData = unwrap(usersResult.data);
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      if (showLoading) setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [pengadaanId]);

  const availableUsers = useMemo(() => {
    const existing = new Set(team?.anggota.map((member) => member.userId) ?? []);
    return users.filter((user) => !existing.has(user.id) && user.role?.kode?.toLowerCase() !== "vendor");
  }, [team?.anggota, users]);
  const assignedStages = (userId: string) =>
    (team?.tahapan ?? [])
      .filter((stage) => stage.assignments.some((assignment) => assignment.userId === userId))
      .map((stage) => stage.label ?? label(stage.tahap))
      .join(", ") || "Belum ditugaskan";
  const teamStages = team?.tahapan.length ? team.tahapan.map((stage) => ({ key: stage.tahap, label: stage.label ?? label(stage.tahap) })) : stages;
  const tableRows = (team?.anggota ?? []).map((member) => ({
    ...member,
    role: member.user.role?.kode ?? "",
    tahap: (team?.tahapan ?? [])
      .filter((stage) => stage.assignments.some((assignment) => assignment.userId === member.userId))
      .map((stage) => stage.tahap)
      .join(" | "),
    tanggungJawab: (team?.tahapan ?? []).flatMap((stage) => stage.assignments.filter((assignment) => assignment.userId === member.userId).map((assignment) => assignment.tanggungJawab)).join(" | "),
  }));

  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      setMemberUserIds([]);
      setMemberOpen(false);
      setRemoveTarget(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Memuat tim pengadaan…</p>;
  if (error && !team) return <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <UsersRound size={18} />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Tim dan penugasan tahap</h2>
            <p className="text-xs text-muted-foreground">PIC UTAMA mengelola workflow dan menyelesaikan tahap. PIC mengerjakan tahap yang ditugaskan. Viewer hanya melihat.</p>
          </div>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setError("");
                setMemberUserIds([]);
                setMemberRole("pic");
                setNewMemberStage("");
                setMemberOpen(true);
              }}
            >
              Tambah & tetapkan
            </Button>
          </div>
        ) : null}
      </header>
      {error && !memberOpen ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        rows={tableRows}
        rowKey={(member) => member.id}
        hidePagination
        searchPlaceholder="Cari anggota…"
        emptyMessage="Belum ada anggota internal."
        filters={[
          {
            field: "peran",
            label: "Peran workflow",
            options: [
              { label: "PIC UTAMA", value: "pic_utama" },
              { label: "PIC", value: "pic" },
              { label: "Viewer", value: "viewer" },
            ],
          },
          { field: "role", label: "Role pengguna", options: Array.from(new Set((team?.anggota ?? []).map((member) => member.user.role?.kode).filter(Boolean))).map((role) => ({ label: String(role), value: String(role) })) },
          { field: "tahap", label: "Tahap penugasan", options: teamStages.map((stage) => ({ label: stage.label, value: stage.key })) },
        ]}
        columns={[
          {
            key: "nama",
            header: "Anggota",
            render: (member) => (
              <>
                <strong>{member.user.nama}</strong>
                <div className="text-xs text-muted-foreground">{member.user.email}</div>
              </>
            ),
          },
          { key: "role", header: "Role", render: (member) => member.user.role?.kode ?? "—" },
          { key: "peran", header: "Peran workflow", render: (member) => ({ pic_utama: "PIC UTAMA", pic: "PIC", viewer: "Viewer" })[member.peran] },
          { key: "tahap", header: "Penugasan", render: (member) => <span className="text-xs">{assignedStages(member.userId)}</span> },
          {
            key: "aksi",
            header: "Aksi",
            filterable: false,
            render: (member) =>
              canManage && !(member.peran === "pic_utama" && (team?.anggota.filter((row) => row.peran === "pic_utama").length ?? 0) <= 1) ? (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => setRemoveTarget(member)}>
                  Hapus
                </Button>
              ) : (
                "—"
              ),
          },
        ]}
      />
      <Modal
        open={memberOpen}
        onClose={() => !busy && setMemberOpen(false)}
        title="Tambah anggota pengadaan"
        description="Pilih pengguna internal aktif."
        footer={
          <>
            <Button variant="outline" onClick={() => setMemberOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button
              disabled={busy || memberUserIds.length === 0 || (memberRole !== "viewer" && !newMemberStage)}
              onClick={() =>
                void mutate(async () => {
                  await request(`/api/pengadaan/${pengadaanId}/team/members/bulk`, "POST", {
                    userIds: memberUserIds,
                    peran: memberRole,
                    ...(memberRole !== "viewer" ? { tahap: newMemberStage } : {}),
                  });
                })
              }
            >
              Tambahkan {memberUserIds.length || ""} anggota
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <FilterCombobox
            options={availableUsers.map((user) => ({ label: `${user.nama} — ${user.email}`, value: user.id }))}
            value=""
            onValueChange={(userId) => {
              if (userId && !memberUserIds.includes(userId)) setMemberUserIds((current) => [...current, userId]);
            }}
            label="Pilih pengguna (bisa tambah banyak)"
          />
          {memberUserIds.length > 0 ? (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{memberUserIds.length} pengguna dipilih</span>
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMemberUserIds([])}>Kosongkan</button>
              </div>
              <ul className="space-y-2">
                {memberUserIds.map((userId) => {
                  const selectedUser = users.find((user) => user.id === userId);
                  return <li key={userId} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{selectedUser?.nama ?? selectedUser?.email ?? userId}<span className="ml-2 text-xs text-muted-foreground">{selectedUser?.email}</span></span>
                    <button type="button" className="shrink-0 text-xs font-medium text-destructive hover:underline" onClick={() => setMemberUserIds((current) => current.filter((id) => id !== userId))}>Hapus</button>
                  </li>;
                })}
              </ul>
            </div>
          ) : null}
          <label className="block space-y-2 text-sm">
            <span>Peran di workflow ini</span>
            <Select
              value={memberRole}
              onValueChange={(value) => {
                const role = value as "pic_utama" | "pic" | "viewer";
                setMemberRole(role);
                if (role === "viewer") setNewMemberStage("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pic">PIC</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="pic_utama">PIC UTAMA</SelectItem>
              </SelectContent>
            </Select>
            <span className="block text-xs text-muted-foreground">Peran ini hanya berlaku untuk pengadaan ini.</span>
          </label>
          {memberRole !== "viewer" ? (
            <label className="block space-y-2 text-sm">
              <span>
                {memberRole === "pic_utama" ? "Tahap tanggung jawab PIC UTAMA" : "Tahap penugasan PIC"} <span className="text-destructive">*</span>
              </span>
              <Select value={newMemberStage} onValueChange={(value) => setNewMemberStage(value ?? "")}>
                <SelectTrigger aria-required="true">
                  <SelectValue placeholder="Pilih tahap" />
                </SelectTrigger>
                <SelectContent>
                  {teamStages.map((stage) => (
                    <SelectItem key={stage.key} value={stage.key}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => !busy && setRemoveTarget(null)}
        title="Hapus anggota"
        message={`Hapus ${removeTarget?.user.nama ?? "anggota"} dari pengadaan? Seluruh assignment aktifnya akan dinonaktifkan.`}
        confirmLabel="Hapus anggota"
        busy={busy}
        onConfirm={() => (removeTarget ? void mutate(() => request(`/api/pengadaan/${pengadaanId}/team/members/${removeTarget.userId}`, "DELETE")) : undefined)}
      />
    </section>
  );
}
