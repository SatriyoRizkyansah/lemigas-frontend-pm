"use client";

import { useMemo, useState } from "react";
import { Check, Circle, RefreshCw } from "lucide-react";
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
  const completionIssue =
    stageKey === "delivery" && !(detail?.pengiriman ?? []).some((shipment: any) => shipment.kontrakId && shipment.pemeriksaan?.length && shipment.penerimaan?.length)
      ? "Catat pemeriksaan dan penerimaan untuk pengiriman terkait kontrak sebelum menyelesaikan delivery."
      : stageKey === "settlement" && !detail?.rekonsiliasi
        ? "Catat rekonsiliasi sebelum menyelesaikan settlement."
        : "";
  const updateStage = use_mutation<unknown, Error, { tahap: "perencanaan" | "sourcing" | "evaluasi_negosiasi" | "approval" | "kontrak" | "delivery" | "settlement" | "selesai"; status: "selesai" | "aktif" }>({
    tag: "siklusTransaksiKomoditas",
    method: "transaksiControllerUpdateTahap",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas")],
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
            <CardContent className="flex gap-2 overflow-x-auto py-5">
              {stages.map((stage) => {
                const status = stagesStatusMap.get(stage.key) as string | undefined;
                const complete = status === "selesai";
                const active = currentStage === stage.key || status === "aktif";
                return (
                  <Button key={stage.key} type="button" variant={stageKey === stage.key ? "default" : "outline"} className="h-auto min-w-36 flex-col items-start gap-1 p-3 text-left" onClick={() => setStageKey(stage.key)}>
                    <span className="flex items-center gap-2">
                      {complete ? <Check size={16} /> : <Circle size={16} />}
                      <strong className="text-xs">{stage.label}</strong>
                    </span>
                    <span className="text-[11px] font-normal opacity-80">{active ? "Tahap aktif" : (status?.replaceAll("_", " ") ?? "Belum mulai")}</span>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{stages.find((stage) => stage.key === stageKey)?.label}</CardTitle>
                <CardDescription className="mt-1">{currentStage === stageKey ? "Tahap aktif" : "Pilih tahap untuk melihat catatan."}</CardDescription>
              </div>
              {canComplete && currentStage === stageKey ? (
                <Button type="button" disabled={updateStage.isPending || Boolean(completionIssue)} onClick={() => setConfirmComplete(true)}>
                  Tandai tahap selesai
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-5">
              {!currentStage && <p className="text-sm text-muted-foreground">Tidak ada tahap aktif. Operasi bisnis terkunci; periksa status transaksi.</p>}
              {completionIssue && currentStage === stageKey && (
                <p role="status" className="text-sm text-muted-foreground">
                  {completionIssue}
                </p>
              )}
              <LifecycleOperations key={stageKey} pengadaanId={pengadaanId} stage={stageKey} active={currentStage === stageKey || (uninitialized && stageKey === "perencanaan")} detail={detail} />
              <LifecycleRecords stage={stageKey} detail={detail ?? {}} />
              <LifecycleDocuments key={`documents-${stageKey}`} pengadaanId={pengadaanId} stage={stageKey} active={currentStage === stageKey} detail={detail} />
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
            <Alert variant="destructive">
              <AlertDescription>{getApiErrorMessage(updateStage.error)}</AlertDescription>
            </Alert>
          ) : null}
        </>
      )}
    </section>
  );
}
