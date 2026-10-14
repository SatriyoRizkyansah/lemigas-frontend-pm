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
    <section className="section page-top">
      <div className="section-head">
        <div>
          <h1 className="page-title">Siklus Pengadaan</h1>
          <p>Rincian tahap transaksi komoditas.</p>
        </div>
        <button className="icon-btn" type="button" aria-label="Muat ulang" onClick={() => void query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={18} />
        </button>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : query.isError ? (
        <div className="dashboard-error" role="alert">
          {getApiErrorMessage(query.error)} <button onClick={() => void query.refetch()}>Coba lagi</button>
        </div>
      ) : (
        <>
          <div className="lifecycle-timeline">
            {stages.map((stage, index) => {
              const status = stagesStatusMap.get(stage.key) as string | undefined;
              const complete = status === "selesai";
              const active = currentStage === stage.key || status === "aktif";
              return (
                <div className="lifecycle-step" key={stage.key}>
                  <button type="button" className={`lifecycle-step-button${stageKey === stage.key ? " is-selected" : ""}`} onClick={() => setStageKey(stage.key)}>
                    <span className={`lifecycle-icon${complete ? " is-complete" : active ? " is-active" : ""}`}>{complete ? <Check size={18} /> : <Circle size={18} />}</span>
                    <strong>{stage.label}</strong>
                    <small>{status?.replaceAll("_", " ") ?? "Belum mulai"}</small>
                  </button>
                  {index < stages.length - 1 && <span className={`lifecycle-line${complete ? " is-complete" : ""}`} />}
                </div>
              );
            })}
          </div>
          <article className="section lifecycle-panel">
            <div className="section-head">
              <div>
                <h2>{stages.find((stage) => stage.key === stageKey)?.label}</h2>
                <p>{currentStage === stageKey ? "Tahap aktif" : "Pilih tahap untuk melihat catatan."}</p>
              </div>
              {currentStage === stageKey && stageKey !== "selesai" && (
                <button type="button" className="btn btn-blue" disabled={updateStage.isPending} onClick={() => updateStage.mutate({ tahap: stageKey, status: "selesai" })}>
                  Tandai tahap selesai
                </button>
              )}
            </div>
            {stageRecords.length ? (
              stageRecords.map(([key, rows]) => (
                <div className="lifecycle-record-group" key={key}>
                  <h3>{key.replaceAll(/([A-Z])/g, " $1").replaceAll("_", " ")}</h3>
                  <ul>
                    {(rows as any[]).map((row, index) => (
                      <li key={row.id ?? index}>
                        {summarize(row)} <span>{row.status ? String(row.status).replaceAll("_", " ") : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="empty">Belum ada catatan pada tahap ini.</p>
            )}
          </article>
          {updateStage.isError && (
            <p className="form-error" role="alert">
              {getApiErrorMessage(updateStage.error)}
            </p>
          )}
        </>
      )}
    </section>
  );
}
