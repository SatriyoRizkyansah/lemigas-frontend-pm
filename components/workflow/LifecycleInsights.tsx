"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/table/DataTable";
import { LoadingState } from "@/components/loading/LoadingState";
import { Modal } from "@/components/modal/Modal";
import { useCurrentUser, apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { browserApi } from "@/lib/api/browser-client";
import { getApiErrorMessage } from "@/lib/api/errors";
import { ContentType } from "@/lib/api/generated/api-generated";
import { apiQueryKeys } from "@/lib/api/query-keys";

const stageOrder = ["perencanaan", "sourcing", "evaluasi_negosiasi", "approval", "kontrak", "delivery", "settlement", "selesai"];

type InsightData = {
  audits: Array<Record<string, any>>;
  events: Array<Record<string, any>>;
  totals: { financial: Array<Record<string, any>>; quantityDeltas: Array<Record<string, any>> };
};

function unwrap(value: unknown): any {
  let current = value as any;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && "data" in current; depth += 1) current = current.data;
  return current;
}
function text(value: unknown): string {
  if (value == null || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function date(value: unknown): string {
  return value ? new Date(String(value)).toLocaleString("id-ID") : "—";
}

export function LifecycleInsights({ pengadaanId, detail }: { pengadaanId: string; detail: Record<string, any> }) {
  const user = useCurrentUser();
  const [recoveryStage, setRecoveryStage] = useState<"delivery" | "settlement" | null>(null);
  const [reason, setReason] = useState("");
  const history = use_query<InsightData, Error, string>({
    tag: "lifecycleHistory",
    method: "transaksiLifecycleHistory",
    params: pengadaanId,
    queryFn: async (id) => {
      setBrowserToken();
      return unwrap(await apiData(browserApi.request<any, any>({ path: `/api/pengadaan/${encodeURIComponent(id)}/lifecycle-history`, method: "GET", format: "json", secure: true })));
    },
  });
  const recovery = use_mutation<any, Error, { tahap: "delivery" | "settlement"; reason: string }>({
    tag: "lifecycleRecovery",
    method: "transaksiLifecycleRecovery",
    invalidateKeys: [
      apiQueryKeys.resource("siklusTransaksiKomoditas"),
      apiQueryKeys.resource("lifecycleHistory"),
      apiQueryKeys.resource("lifecycleEvidence"),
      apiQueryKeys.resource("dokumen"),
      apiQueryKeys.resource("pengadaan"),
      apiQueryKeys.resource("dashboard"),
    ],
    mutationFn: async (body) => {
      setBrowserToken();
      return unwrap(await apiData(browserApi.request<any, any>({ path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/lifecycle-recovery`, method: "POST", body, type: ContentType.Json, format: "json", secure: true })));
    },
    onSuccess: async () => {
      setRecoveryStage(null);
      setReason("");
    },
  });
  const isAdmin = user.data?.role?.toLowerCase() === "admin";
  const stageRows: Array<{ tahap: string; status: string }> = detail.tahapan ?? [];
  const stages = new Map(stageRows.map((row) => [row.tahap, row.status]));
  let frontier = false;
  const canonical =
    stageRows.length === stageOrder.length &&
    stages.size === stageOrder.length &&
    stageOrder.every((stage) => {
      const status = stages.get(stage);
      if (!status || (frontier && status !== "draft")) return false;
      if (status !== "selesai") frontier = true;
      return true;
    });
  const canRecover = (stage: string) => canonical && stages.get(stage) === "selesai" && stageOrder.slice(0, stageOrder.indexOf(stage)).every((previous) => stages.get(previous) === "selesai");
  const missingDocuments = (stage: string) => (detail.persyaratanDokumen ?? []).some((row: any) => row.tahap === stage && row.wajib && !row.terpenuhi);
  const missingShipment = !(detail.pengiriman ?? []).some((row: any) => row.kontrakId && row.pemeriksaan?.length && row.penerimaan);
  const hasDeliveryGap = missingShipment || missingDocuments("delivery");
  const hasSettlementGap = missingShipment || !(detail.tagihan ?? []).some((row: any) => row.pembayaran?.length) || missingDocuments("settlement");
  const recoveryOptions = isAdmin ? ([...(canRecover("delivery") && hasDeliveryGap ? ["delivery" as const] : []), ...(canRecover("settlement") && hasSettlementGap ? ["settlement" as const] : [])] as const) : [];
  const data = history.data;
  return (
    <div className="space-y-6 border-t pt-5">
      <div>
        <h3 className="text-sm font-semibold">Histori dan rekonsiliasi lifecycle</h3>
        <p className="mt-1 text-xs text-muted-foreground">Nilai tetap dikelompokkan per mata uang; selisih kuantitas ditampilkan per pengiriman.</p>
      </div>
      {history.isPending ? <LoadingState label="Loading..." /> : null}
      {history.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getApiErrorMessage(history.error)}{" "}
            <Button size="sm" variant="link" onClick={() => void history.refetch()}>
              Coba lagi
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {data ? (
        <>
          <DataTable
            title="Event lifecycle"
            rows={data.events}
            rowKey={(row) => row.id}
            columns={[
              { key: "createdAt", header: "Waktu", render: (row) => date(row.createdAt) },
              { key: "type", header: "Jenis", render: (row) => text(row.type) },
              { key: "action", header: "Aksi", render: (row) => text(row.action) },
              { key: "actor", header: "Aktor", render: (row) => text(row.actor?.nama ?? row.actor?.email) },
              { key: "recordId", header: "Record", render: (row) => text(row.recordId) },
            ]}
            emptyMessage="Belum ada event lifecycle."
          />
          <DataTable
            title="Audit history"
            rows={data.audits}
            rowKey={(row) => row.id}
            columns={[
              { key: "createdAt", header: "Waktu", render: (row) => date(row.createdAt) },
              { key: "tabel", header: "Tabel", render: (row) => text(row.tabel) },
              { key: "aksi", header: "Aksi", render: (row) => text(row.aksi) },
              { key: "actor", header: "Aktor", render: (row) => text(row.dilakukanOlehUser?.nama ?? row.dilakukanOlehUser?.email ?? row.dilakukanOleh) },
              { key: "recordId", header: "Record", render: (row) => text(row.recordId) },
            ]}
            emptyMessage="Belum ada audit pada record lifecycle ini."
          />
          <p className="text-xs text-muted-foreground">
            Total dipisah menurut mata uang dan arah masuk/keluar. Invoice dihitung hanya untuk status diterbitkan, dibayar_sebagian, atau lunas; pembayaran hanya status selesai. Outstanding tidak tersedia bila arah, invoice terkait, atau
            mata uang tidak sebanding.
          </p>
          <DataTable
            title="Total invoice dan pembayaran"
            rows={data.totals.financial}
            rowKey={(row) => JSON.stringify([row.currency, row.direction])}
            columns={[
              { key: "currency", header: "Mata uang", render: (row) => text(row.currency) },
              { key: "direction", header: "Arah", render: (row) => (row.direction === "masuk" ? "Masuk" : row.direction === "keluar" ? "Keluar" : "Tidak diketahui") },
              { key: "invoice", header: "Invoice", render: (row) => text(row.invoice) },
              { key: "payment", header: "Pembayaran", render: (row) => text(row.payment) },
              { key: "outstanding", header: "Outstanding", render: (row) => (row.outstandingComparable === true ? text(row.outstanding) : "Tidak dapat dibandingkan") },
            ]}
            emptyMessage="Belum ada invoice atau pembayaran."
          />
          <DataTable
            title="Selisih penerimaan"
            rows={data.totals.quantityDeltas}
            rowKey={(row) => row.shipmentId}
            columns={[
              { key: "reference", header: "Pengiriman", render: (row) => text(row.reference) },
              { key: "unit", header: "Satuan", render: (row) => text(row.unit) },
              { key: "contracted", header: "Kontrak", render: (row) => text(row.contracted) },
              { key: "actual", header: "Aktual", render: (row) => text(row.actual) },
              { key: "accepted", header: "Diterima", render: (row) => text(row.accepted) },
              { key: "acceptedMinusContracted", header: "Selisih vs kontrak", render: (row) => text(row.acceptedMinusContracted) },
              { key: "acceptedMinusActual", header: "Selisih vs aktual", render: (row) => text(row.acceptedMinusActual) },
            ]}
            emptyMessage="Belum ada data kuantitas penerimaan."
          />
        </>
      ) : null}
      {recoveryOptions.length ? (
        <Alert>
          <AlertDescription className="space-y-3">
            <div>Record atau dokumen wajib belum lengkap pada tahap yang sudah selesai. Recovery hanya membuka kembali tahap yang dipilih dan mereset tahap sesudahnya.</div>
            <div className="flex flex-wrap gap-2">
              {recoveryOptions.map((stage) => (
                <Button key={stage} size="sm" variant="outline" onClick={() => setRecoveryStage(stage)}>
                  Buka kembali {stage}
                </Button>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      {recovery.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(recovery.error)}</AlertDescription>
        </Alert>
      ) : null}
      {recovery.isSuccess ? (
        <p role="status" className="text-sm text-muted-foreground">
          Tahap dibuka kembali. Lengkapi record wajib sebelum menyelesaikannya lagi.
        </p>
      ) : null}
      <Modal
        open={Boolean(recoveryStage)}
        onClose={() => {
          if (!recovery.isPending) setRecoveryStage(null);
        }}
        title="Konfirmasi recovery historis"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={recovery.isPending} onClick={() => setRecoveryStage(null)}>
              Batal
            </Button>
            <Button disabled={recovery.isPending || reason.trim().length < 10 || !recoveryOptions.some((stage) => stage === recoveryStage)} onClick={() => recoveryStage && recovery.mutate({ tahap: recoveryStage, reason: reason.trim() })}>
              Konfirmasi recovery
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p>Recovery {recoveryStage ?? "tahap"} akan diaudit dan tidak dapat melompat ke tahap lain.</p>
          <label className="block text-sm font-medium" htmlFor="recovery-reason">
            Alasan
          </label>
          <textarea
            id="recovery-reason"
            className="min-h-24 w-full rounded-md border bg-background p-2 text-sm"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Jelaskan pemeriksaan dan record historis yang belum tercatat."
          />
        </div>
      </Modal>
    </div>
  );
}
