"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Circle, RefreshCw } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { LoadingState } from "@/components/loading/LoadingState";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LifecycleOperations } from "./LifecycleOperations";
import { LifecycleDocuments } from "./LifecycleDocuments";
import { LifecycleRecords } from "./LifecycleRecords";
import { LifecycleEvidence } from "./LifecycleEvidence";
import { ConfirmDialog } from "@/components/modal/ConfirmDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";

const stages = [
  { key: "perencanaan", label: "Perencanaan" },
  { key: "sourcing", label: "Sourcing" },
  { key: "evaluasi_negosiasi", label: "Evaluasi & Negosiasi" },
  { key: "approval", label: "Approval" },
  { key: "kontrak", label: "Kontrak" },
  { key: "delivery", label: "Delivery" },
  { key: "settlement", label: "Settlement" },
  { key: "selesai", label: "Selesai" },
] as const;
function unwrap(value: unknown): any {
  let data = value as any;
  for (let i = 0; i < 3 && data && typeof data === "object" && "data" in data; i += 1) data = data.data;
  return data;
}

export default function LifecyclePage({ pengadaanId }: { pengadaanId: string }) {
  const [stageKey, setStageKey] = useState<(typeof stages)[number]["key"]>("perencanaan");
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
  const updateStage = use_mutation<unknown, Error, { tahap: "perencanaan" | "sourcing" | "evaluasi_negosiasi" | "approval" | "kontrak" | "delivery" | "settlement" | "selesai"; status: "selesai" | "aktif" }>({
    tag: "siklusTransaksiKomoditas",
    method: "transaksiControllerUpdateTahap",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("lifecycleEvidence"), apiQueryKeys.resource("pengadaan"), apiQueryKeys.resource("dashboard")],
    mutationFn: async (body) => {
      setBrowserToken();
      return apiData(browserApi.siklusTransaksiKomoditas.transaksiControllerUpdateTahap(pengadaanId, body, { format: "json" }) as Promise<{ data: unknown }>);
    },
  });
  const stagesStatusMap = useMemo(() => new Map(stageStatus.map((item: any) => [item.tahap, item.status])), [stageStatus]);
  return (
    <section className="space-y-5 py-1">
      <PageHeader
        title="Siklus Pengadaan"
        description="Rincian tahap transaksi komoditas."
        actions={
          <Button variant="outline" size="icon" type="button" aria-label="Muat ulang" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw size={18} className={query.isFetching ? "spin" : undefined} />
          </Button>
        }
      />
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {getApiErrorMessage(query.error)}{" "}
            <Button variant="link" size="sm" type="button" onClick={() => void query.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardContent className="py-5">
              <ol className="grid gap-x-5 sm:grid-cols-2 lg:grid-cols-4">
                {stages.map((stage, index) => {
                  const status = stagesStatusMap.get(stage.key) as string | undefined;
                  const complete = status === "selesai";
                  const active = currentStage === stage.key || status === "aktif";
                  const selectedStage = stageKey === stage.key;
                  return (
                    <li key={stage.key} className="min-w-0">
                      <Button
                        type="button"
                        variant="ghost"
                        aria-current={selectedStage ? "step" : undefined}
                        className={`h-auto min-h-[4.5rem] w-full justify-start gap-3 rounded-lg px-3 text-left hover:bg-muted/70 ${selectedStage ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
                        onClick={() => setStageKey(stage.key)}
                      >
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-full border-2 ${complete ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-primary bg-primary text-primary-foreground" : selectedStage ? "border-primary text-primary" : "border-muted-foreground/40 bg-background text-muted-foreground"}`}
                          aria-label={`Tahap ${index + 1}`}
                        >
                          <span className="text-xs font-semibold">{index + 1}</span>
                        </span>
                        <span className="min-w-0">
                          <strong className="block whitespace-normal text-sm">{stage.label}</strong>
                          <span className="block text-xs font-normal text-muted-foreground">{active ? "Tahap aktif" : (status?.replaceAll("_", " ") ?? "Belum mulai")}</span>
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{stages.find((stage) => stage.key === stageKey)?.label}</CardTitle>
                <CardDescription className="mt-1">{currentStage === stageKey ? "Tahap aktif" : "Pilih tahap untuk melihat catatan."}</CardDescription>
              </div>
              {canComplete && currentStage === stageKey ? (
                <Button type="button" disabled={updateStage.isPending} onClick={() => setConfirmComplete(true)}>
                  Tandai tahap selesai
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-5">
              {!currentStage && <p className="text-sm text-muted-foreground">Tidak ada tahap aktif. Operasi bisnis terkunci; periksa status transaksi.</p>}
              {completionIssue && currentStage === stageKey && (
                <Alert variant="default" role="status">
                  <AlertDescription>Kendala penyelesaian: {completionIssue}</AlertDescription>
                </Alert>
              )}
              <details className="group rounded-lg border px-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
                  Operasi tahap
                  <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t py-4">
                  <LifecycleOperations key={stageKey} pengadaanId={pengadaanId} stage={stageKey} active={currentStage === stageKey || (uninitialized && stageKey === "perencanaan")} detail={detail} />
                </div>
              </details>
              <details className="group rounded-lg border px-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
                  Catatan tahap
                  <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t py-4">
                  <LifecycleRecords stage={stageKey} active={currentStage === stageKey} pengadaanId={pengadaanId} detail={detail ?? {}} />
                </div>
              </details>
              <details className="group rounded-lg border px-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
                  Dokumen pengadaan
                  <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t py-4">
                  <LifecycleDocuments key={`documents-${stageKey}`} pengadaanId={pengadaanId} stage={stageKey} active={currentStage === stageKey} detail={detail} />
                </div>
              </details>
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
            onConfirm={() => updateStage.mutate({ tahap: stageKey, status: "selesai" }, { onSuccess: () => setConfirmComplete(false) })}
          />
          {updateStage.isSuccess && (
            <p role="status" className="text-sm text-muted-foreground">
              Tahap berhasil diselesaikan.
            </p>
          )}
          {updateStage.isError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription className="flex flex-wrap items-center gap-2">
                {getApiErrorMessage(updateStage.error)}
                <Button type="button" variant="link" size="sm" onClick={() => void query.refetch()}>
                  Muat ulang tahap
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      )}
    </section>
  );
}
