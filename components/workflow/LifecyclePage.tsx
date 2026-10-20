"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, LockKeyhole, RefreshCw, ClipboardList, FileText, Settings2 } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { LoadingState } from "@/components/loading/LoadingState";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LifecycleOperations } from "./LifecycleOperations";
import { LifecycleDocuments } from "./LifecycleDocuments";
import { LifecycleRecords } from "./LifecycleRecords";
import { LifecycleEvidence } from "./LifecycleEvidence";
import { TeamAssignmentPanel } from "./TeamAssignmentPanel";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";

type WorkflowStage = { key: string; label: string; urutan?: number; assignments?: { tanggungJawab?: string; userId?: string; user?: { id?: string; nama?: string } }[] };
function unwrap(value: unknown): any {
  let data = value as any;
  for (let i = 0; i < 3 && data && typeof data === "object" && "data" in data; i += 1) data = data.data;
  return data;
}

export default function LifecyclePage({ pengadaanId }: { pengadaanId: string }) {
  const [stageKey, setStageKey] = useState("perencanaan");
  const [confirmComplete, setConfirmComplete] = useState(false);
  const currentUser = useCurrentUser();
  const canComplete = ["admin", "operator", "pimpinan"].includes(currentUser.data?.role.toLowerCase() ?? "");
  const query = use_query<any, Error, string>({
    tag: "siklusTransaksiKomoditas",
    method: "transaksiControllerDetail",
    params: pengadaanId,
    queryFn: async (id) => {
      setBrowserToken();
      return unwrap(await apiData(browserApi.siklusTransaksiKomoditas.transaksiControllerDetail(id, { format: "json" }) as Promise<{ data: unknown }>));
    },
  });
  const detail = query.data;
  const stageStatus = detail?.tahapan ?? [];
  const currentMember = (detail?.anggota ?? []).find((member: any) => member.userId === currentUser.data?.id && member.aktif);
  const canManageTeam = currentUser.data?.role.toLowerCase() === "admin" || currentMember?.peran === "pic_utama" || currentMember?.peran === "owner";
  const stages: WorkflowStage[] = stageStatus.length
    ? stageStatus.map((stage: any) => ({ key: stage.tahap, label: stage.label ?? stage.tahap.replaceAll("_", " "), urutan: stage.urutan, assignments: stage.assignments }))
    : [{ key: "perencanaan", label: "Perencanaan" }];
  const assignedStageKeys = new Set(stages.filter((stage) => stage.assignments?.some((assignment) => (assignment.userId ?? assignment.user?.id) === currentUser.data?.id)).map((stage) => stage.key));
  const systemRole = currentUser.data?.role.toLowerCase() ?? "";
  const privilegedStageViewer = ["admin", "pimpinan"].includes(systemRole);
  const stageRestricted = !privilegedStageViewer && Boolean(currentMember && ["pic", "pic_utama", "viewer"].includes(currentMember.peran));
  const accessibleStages = stageRestricted ? stages.filter((stage) => assignedStageKeys.has(stage.key)) : stages;
  const fallbackStage = accessibleStages[0]?.key ?? stages[0].key;
  const selectedStage = accessibleStages.some((stage) => stage.key === stageKey) ? stageKey : fallbackStage;
  const stageLocked = (key: string) => stageRestricted && !assignedStageKeys.has(key);
  const currentStage = stageStatus.find((item: any) => item.status === "aktif")?.tahap;
  const uninitialized = Boolean(detail && stageStatus.length === 0);
  const missingDocuments = (detail?.persyaratanDokumen ?? []).filter((row: any) => row.tahap === stageKey && row.wajib && !row.terpenuhi);
  const laporanAkhir = (detail?.laporan ?? []).filter((laporan: any) => laporan.jenis?.toLowerCase() === "akhir");
  const laporanAkhirValid = laporanAkhir.some((laporan: any) => ["diterbitkan", "disetujui"].includes(laporan.status));
  const laporanAkhirDraft = laporanAkhir.some((laporan: any) => laporan.status === "draft");
  const completionIssue =
    stageKey !== "selesai" && missingDocuments.length
      ? `Lengkapi dokumen wajib: ${missingDocuments.map((row: any) => row.jenisDokumen).join(", ")}.`
      : stageKey === "delivery" && !(detail?.pengiriman ?? []).some((shipment: any) => shipment.kontrakId && shipment.pemeriksaan?.length && shipment.penerimaan)
        ? "Catat pemeriksaan dan penerimaan untuk pengiriman terkait kontrak sebelum menyelesaikan delivery."
        : stageKey === "settlement" &&
            (!(detail?.pengiriman ?? []).some((shipment: any) => shipment.kontrakId && shipment.pemeriksaan?.length && shipment.penerimaan) || !(detail?.tagihan ?? []).some((tagihan: any) => tagihan.pembayaran?.length))
          ? "Catat pemeriksaan dan penerimaan pengiriman terkait kontrak, tagihan, dan pembayaran sebelum menyelesaikan settlement."
          : stageKey === "selesai" && detail?.rekonsiliasi?.status !== "selesai"
            ? `Tandai rekonsiliasi selesai terlebih dahulu (status saat ini: ${detail?.rekonsiliasi?.status ?? "belum dicatat"}). Pilih operasi “Ubah status rekonsiliasi” di tahap Selesai.`
            : stageKey === "selesai" && !laporanAkhirValid
              ? laporanAkhirDraft
                ? "Laporan akhir masih draft. Terbitkan laporan akhir dari operasi “Terbitkan laporan”, lalu muat ulang data."
                : laporanAkhir.length
                  ? `Laporan akhir ditemukan, tetapi statusnya “${laporanAkhir.map((laporan: any) => laporan.status).join(", ")}”. Terbitkan laporan akhir, lalu muat ulang data.`
                  : "Laporan akhir belum ada. Buat laporan dengan jenis tepat “akhir”, lalu terbitkan dari operasi “Terbitkan laporan”."
              : "";
  const updateStage = use_mutation<unknown, Error, { tahap: string; status: "selesai" | "aktif" }>({
    tag: "siklusTransaksiKomoditas",
    method: "transaksiControllerUpdateTahap",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("lifecycleEvidence"), apiQueryKeys.resource("pengadaan"), apiQueryKeys.resource("dashboard")],
    mutationFn: async (body) => {
      setBrowserToken();
      // Generated client still has legacy tender-only stage union until API codegen runs.
      return apiData(browserApi.siklusTransaksiKomoditas.transaksiControllerUpdateTahap(pengadaanId, body as any, { format: "json" }) as Promise<{ data: unknown }>);
    },
  });
  const stagesStatusMap = useMemo(() => new Map(stageStatus.map((item: any) => [item.tahap, item.status])), [stageStatus]);
  return (
    <section className="space-y-5 py-1">
      <PageHeader
        title="Siklus Pengadaan"
        description="Rincian tahap transaksi komoditas."
        actions={
          <div className="flex items-center gap-2">
            {canManageTeam ? (
              <Button variant="outline" size="icon" type="button" aria-label="Pengaturan anggota" title="Pengaturan anggota" render={<Link href={`/dashboard/pengadaan/${pengadaanId}/tim`} />}>
                <Settings2 size={18} />
              </Button>
            ) : null}
            <Button variant="outline" size="icon" type="button" aria-label="Muat ulang" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw size={18} className={query.isFetching ? "spin" : undefined} />
            </Button>
          </div>
        }
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <div className="flex justify-center py-8">
          <Button variant="outline" size="sm" type="button" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <>
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Tahapan transaksi</CardTitle>
                  <CardDescription className="mt-1">Pilih tahap untuk melihat aktivitas dan dokumen terkait.</CardDescription>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {stageStatus.filter((item: any) => item.status === "selesai").length} dari {stages.length} tahap selesai
                </p>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-label="Progres siklus">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(stageStatus.filter((item: any) => item.status === "selesai").length / stages.length) * 100}%` }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 py-4 sm:px-5">
              <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {stages.map((stage, index) => {
                  const status = stagesStatusMap.get(stage.key) as string | undefined;
                  const complete = status === "selesai";
                  const active = currentStage === stage.key || status === "aktif";
                  const isSelectedStage = selectedStage === stage.key;
                  const locked = stageLocked(stage.key);
                  return (
                    <li key={stage.key} className="min-w-0">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={locked}
                        aria-current={isSelectedStage ? "step" : undefined}
                        className={`h-auto min-h-[4.25rem] w-full justify-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${isSelectedStage ? "border-primary/40 bg-primary/5 shadow-sm hover:bg-primary/10" : "border-transparent hover:border-border hover:bg-muted/50"}`}
                        onClick={() => setStageKey(stage.key)}
                      >
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-full border ${locked ? "border-muted bg-muted text-muted-foreground" : complete ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}
                          aria-label={locked ? `Tahap ${index + 1} terkunci` : `Tahap ${index + 1}`}
                        >
                          {locked ? <LockKeyhole size={15} aria-hidden="true" /> : complete ? <Check size={16} aria-hidden="true" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block whitespace-normal text-sm font-semibold leading-5">{stage.label}</strong>
                          <span className={`mt-0.5 block text-xs font-normal ${active ? "text-primary" : "text-muted-foreground"}`}>
                            {active ? "Sedang berjalan" : complete ? "Selesai" : (status?.replaceAll("_", " ") ?? "Belum dimulai")}
                          </span>
                          {stage.assignments?.length ? (
                            <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                              PIC:{" "}
                              {stage.assignments
                                .map((assignment) => assignment.user?.nama)
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          ) : null}
                        </span>
                        {isSelectedStage && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Tahap dipilih" />}
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between gap-4 border-b bg-muted/30 px-4 py-4 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border bg-background text-primary">
                  <span className="text-sm font-bold">{stages.findIndex((stage) => stage.key === stageKey) + 1}</span>
                </span>
                <div className="min-w-0">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">Detail tahap</CardDescription>
                  <CardTitle className="mt-1 truncate text-lg">{stages.find((stage) => stage.key === selectedStage)?.label}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">{currentStage === selectedStage ? "Tahap ini sedang berjalan" : "Tahap dipilih untuk ditinjau"}</p>
                </div>
              </div>
              {canComplete && currentStage === selectedStage ? (
                <Button
                  type="button"
                  className="shrink-0"
                  disabled={updateStage.isPending}
                  onClick={() => {
                    if (completionIssue) {
                      window.dispatchEvent(new CustomEvent("api:error", { detail: { message: completionIssue } }));
                      return;
                    }
                    setConfirmComplete(true);
                  }}
                >
                  Tandai tahap selesai
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {stageLocked(selectedStage) ? (
                <Alert variant="default">
                  <LockKeyhole size={16} />
                  <AlertDescription>Tahap ini terkunci. Anda hanya dapat membuka tahap yang menjadi tanggung jawab Anda.</AlertDescription>
                </Alert>
              ) : (
                <>
                  {!currentStage && <p className="rounded-lg border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">Tidak ada tahap aktif. Operasi bisnis terkunci; periksa status transaksi.</p>}
                  <div className="flex flex-col gap-3">
                    <details className="group overflow-hidden rounded-xl border bg-background open:border-primary/30 open:shadow-sm">
                      <summary className="flex min-h-[4.5rem] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Settings2 size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-sm font-semibold">Operasi tahap</strong>
                          <span className="mt-0.5 block text-xs text-muted-foreground">Perbarui data transaksi</span>
                        </span>
                        <ChevronDown size={17} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t bg-muted/10 px-4 py-4">
                        <LifecycleOperations key={selectedStage} pengadaanId={pengadaanId} stage={selectedStage} active={currentStage === selectedStage || (uninitialized && selectedStage === "perencanaan")} detail={detail} />
                      </div>
                    </details>
                    <details className="group overflow-hidden rounded-xl border bg-background open:border-primary/30 open:shadow-sm">
                      <summary className="flex min-h-[4.5rem] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
                          <ClipboardList size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-sm font-semibold">Catatan tahap</strong>
                          <span className="mt-0.5 block text-xs text-muted-foreground">Riwayat dan catatan proses</span>
                        </span>
                        <ChevronDown size={17} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t bg-muted/10 px-4 py-4">
                        <LifecycleRecords stage={selectedStage} active={currentStage === selectedStage} pengadaanId={pengadaanId} detail={detail ?? {}} />
                      </div>
                    </details>
                    <details className="group overflow-hidden rounded-xl border bg-background open:border-primary/30 open:shadow-sm">
                      <summary className="flex min-h-[4.5rem] cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          <FileText size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-sm font-semibold">Dokumen pengadaan</strong>
                          <span className="mt-0.5 block text-xs text-muted-foreground">Persyaratan dan berkas terkait</span>
                        </span>
                        <ChevronDown size={17} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t bg-muted/10 px-4 py-4">
                        <LifecycleDocuments key={`documents-${selectedStage}`} pengadaanId={pengadaanId} stage={selectedStage} active={currentStage === selectedStage} detail={detail} />
                      </div>
                    </details>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <ConfirmDialog
            open={confirmComplete}
            onClose={() => {
              if (!updateStage.isPending) setConfirmComplete(false);
            }}
            title="Selesaikan tahap"
            message="Selesaikan tahap ini? Backend akan memeriksa kelengkapan record dan dokumen wajib sebelum melanjutkan."
            confirmLabel="Selesaikan tahap"
            busy={updateStage.isPending}
            onConfirm={() =>
              updateStage.mutate(
                { tahap: selectedStage, status: "selesai" },
                {
                  onSuccess: () => setConfirmComplete(false),
                },
              )
            }
          />
        </>
      )}
    </section>
  );
}
