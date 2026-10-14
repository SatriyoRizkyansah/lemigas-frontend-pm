"use client";

import { useMemo, useState } from "react";
import { Check, Circle, RefreshCw } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { LoadingState } from "@/components/loading/LoadingState";
import { getApiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/loading/EmptyState";

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
function summarize(value: unknown): string {
  if (value == null || typeof value !== "object") return String(value ?? "—");
  const item = value as Record<string, unknown>;
  return String(item.nama ?? item.judul ?? item.nomor ?? item.status ?? item.id ?? "Record");
}

export default function LifecyclePage({ pengadaanId }: { pengadaanId: string }) {
  const [stageKey, setStageKey] = useState<(typeof stages)[number]["key"]>("perencanaan");
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
  const stageData = detail?.[stageKey] ?? detail?.data?.[stageKey];
  const stageRecords = Object.entries(stageData ?? {}).filter(([, value]) => Array.isArray(value) && value.length);
  const currentStage = detail?.tahapAktif ?? detail?.tahapPengadaan?.find?.((item: any) => item.status === "aktif")?.tahap ?? stageKey;
  const stageStatus = detail?.tahapPengadaan ?? detail?.tahapan ?? [];
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
              {currentStage === stageKey && stageKey !== "selesai" ? (
                <Button type="button" disabled={updateStage.isPending} onClick={() => updateStage.mutate({ tahap: stageKey, status: "selesai" })}>
                  Tandai tahap selesai
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-5">
              {stageRecords.length ? (
                stageRecords.map(([key, rows]) => (
                  <div className="space-y-2" key={key}>
                    <h3 className="text-sm font-semibold capitalize">{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</h3>
                    <ul className="divide-y divide-border rounded-lg border border-border">
                      {(rows as any[]).map((row, index) => (
                        <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" key={row.id ?? index}>
                          <span>{summarize(row)}</span>
                          {row.status ? <Badge variant="outline">{String(row.status).replaceAll("_", " ")}</Badge> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              ) : (
                <EmptyState title="Belum ada catatan" description="Belum ada catatan pada tahap ini." />
              )}
            </CardContent>
          </Card>
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
