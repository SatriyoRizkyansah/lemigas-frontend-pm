"use client";

import { Check, CircleAlert, FileText, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Entity, Operation } from "./lifecycle-operations-config";

type SettlementChecklistProps = {
  active: boolean;
  locked: boolean;
  operations: Operation[];
  planning: Entity;
  invoices: Entity[];
  shipments: Entity[];
  payments: Entity[];
  claims: Entity[];
  reconciliation?: Entity;
  totals: Entity;
  totalsLoading?: boolean;
  totalsError?: string;
  documentRequirements: Entity[];
  readiness?: Entity;
  onOpen: (operation: Operation, context?: Entity) => void;
};

const asText = (value: unknown) => (value == null ? "" : String(value));
const asNumber = (value: unknown) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};
const rows = (value: unknown): Entity[] =>
  Array.isArray(value)
    ? value.map((row) =>
        row && typeof row === "object" ? (row as Entity) : {},
      )
    : [];
const entity = (value: unknown): Entity =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Entity)
    : {};
const statusLabel: Record<string, string> = {
  draft: "Perlu diverifikasi",
  diverifikasi: "Siap diterbitkan",
  diterbitkan: "Menunggu pembayaran",
  dibayar_sebagian: "Dibayar sebagian",
  lunas: "Lunas",
  ditolak: "Ditolak",
  dibatalkan: "Dibatalkan",
  aktif: "Diproses",
  selesai: "Selesai",
};
const money = (value: unknown, currency: unknown) => {
  const amount = asNumber(value);
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 4,
  }).format(amount);
  return `${asText(currency) || "—"} ${formatted}`;
};
const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("id-ID") : "—";
const shipmentName = (shipment: Entity) =>
  asText(shipment.namaKapal) || asText(shipment.nomorBillOfLading) || "Kargo";
const invoiceShipments = (invoice: Entity) =>
  rows(invoice.kargo).map((link) =>
    link.pengiriman && typeof link.pengiriman === "object"
      ? (link.pengiriman as Entity)
      : link,
  );
const invoicePaid = (invoice: Entity) =>
  rows(invoice.pembayaran)
    .filter((payment) => payment.status === "selesai")
    .reduce((sum, payment) => sum + asNumber(payment.nilai), 0);

export function getReconciliationReadiness(
  planning: Entity,
  invoices: Entity[],
  shipments: Entity[],
  claims: Entity[],
) {
  const requiredIncoming =
    planning.modelPelaksanaan === "pengelolaan_manajemen_impor";
  const requiredDirections = requiredIncoming ? ["masuk", "keluar"] : ["keluar"];
  const activeInvoices = invoices.filter(
    (invoice) => !["ditolak", "dibatalkan"].includes(asText(invoice.status)),
  );
  const relevantInvoices = requiredIncoming
    ? activeInvoices
    : activeInvoices.filter((invoice) => invoice.arah === "keluar");
  const issuedStatuses = ["diterbitkan", "dibayar_sebagian", "lunas"];
  const missingReceipts = shipments.filter(
    (shipment) => entity(shipment.penerimaan).kuantitasDiterima == null,
  );
  const deliveryReady = shipments.length > 0 && missingReceipts.length === 0;
  const claimsToTrack = claims.filter(
    (claim) =>
      !["selesai", "ditolak", "dibatalkan"].includes(asText(claim.status)),
  );
  const claimsReady = claimsToTrack.every(
    (claim) =>
      claim.status === "aktif" &&
      claim.tetapDipantau === true &&
      Boolean(asText(claim.penanggungJawab).trim()) &&
      Boolean(asText(claim.tindakLanjut).trim()) &&
      Boolean(claim.tindakLanjutPada),
  );
  const unsupportedIncoming =
    !requiredIncoming && activeInvoices.some((invoice) => invoice.arah === "masuk");
  const missingDirections = requiredDirections.filter(
    (direction) =>
      !relevantInvoices.some((invoice) => invoice.arah === direction),
  );
  const notIssuedInvoices = relevantInvoices.filter(
    (invoice) => !issuedStatuses.includes(asText(invoice.status)),
  );
  const unpaidInvoices = relevantInvoices.filter(
    (invoice) =>
      Math.abs(invoicePaid(invoice) - asNumber(invoice.nilai)) >= 0.00005,
  );
  const financialReady =
    !unsupportedIncoming &&
    missingDirections.length === 0 &&
    notIssuedInvoices.length === 0 &&
    unpaidInvoices.length === 0;
  const blockers: string[] = [];

  if (!shipments.length) {
    blockers.push("Belum ada kargo untuk dicocokkan.");
  } else if (!deliveryReady) {
    blockers.push(`${missingReceipts.length} kargo belum memiliki kuantitas BAST.`);
  }
  if (unsupportedIncoming) {
    blockers.push("Batalkan tagihan Penerima Pasokan yang masih aktif karena modelnya impor langsung.");
  }
  for (const direction of missingDirections) {
    blockers.push(
      direction === "masuk"
        ? "Belum ada tagihan aktif dari Penerima Pasokan."
        : "Belum ada tagihan aktif dari Penyedia.",
    );
  }
  if (notIssuedInvoices.length) {
    blockers.push(`${notIssuedInvoices.length} tagihan belum diverifikasi dan diterbitkan.`);
  }
  if (unpaidInvoices.length) {
    blockers.push(`${unpaidInvoices.length} tagihan belum lunas berdasarkan pembayaran yang dikonfirmasi.`);
  }
  if (!claimsReady) {
    blockers.push("Tutup klaim terbuka atau lengkapi penanggung jawab, tindak lanjut, dan tanggal pemantauannya.");
  }

  return {
    deliveryReady,
    financialReady,
    claimsReady,
    ready: deliveryReady && financialReady && claimsReady,
    blockers,
    activeInvoiceCount: relevantInvoices.length,
    receivedCargoCount: shipments.length - missingReceipts.length,
    openClaimCount: claimsToTrack.length,
  };
}

function StatusPill({ value, label }: { value: unknown; label?: string }) {
  const status = asText(value);
  const tone = ["lunas", "selesai"].includes(status)
    ? "bg-emerald-100 text-emerald-800"
    : ["ditolak", "dibatalkan"].includes(status)
      ? "bg-destructive/10 text-destructive"
      : "bg-amber-100 text-amber-800";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label ?? statusLabel[status] ?? status.replaceAll("_", " ")}
    </span>
  );
}

function InvoiceLane({
  title,
  description,
  direction,
  required,
  invoices,
  operation,
  updateOperation,
  paymentOperation,
  paymentStatusOperation,
  active,
  locked,
  hideAddAction = false,
  onOpen,
}: {
  title: string;
  description: string;
  direction: "masuk" | "keluar";
  required: boolean;
  invoices: Entity[];
  operation?: Operation;
  updateOperation?: Operation;
  paymentOperation?: Operation;
  paymentStatusOperation?: Operation;
  active: boolean;
  locked: boolean;
  hideAddAction?: boolean;
  onOpen: (operation: Operation, context?: Entity) => void;
}) {
  const laneInvoices = invoices.filter((invoice) => invoice.arah === direction);
  return (
    <section className="space-y-3 px-4 py-4 sm:px-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {laneInvoices.length} tagihan
            </span>
            {required ? (
              <span className="text-[11px] font-medium text-muted-foreground">
                Wajib untuk model ini
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {operation && !hideAddAction ? (
          <Button
            type="button"
            size="sm"
            variant={laneInvoices.length ? "outline" : "default"}
            disabled={!active || locked}
            onClick={() => onOpen(operation, { arah: direction })}
          >
            <Plus size={15} /> {laneInvoices.length ? "Tambah tagihan" : "Catat tagihan"}
          </Button>
        ) : null}
      </header>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Tagihan dan kargo</th>
              <th className="px-3 py-2.5 font-medium">Nilai</th>
              <th className="px-3 py-2.5 font-medium">Jatuh tempo</th>
              <th className="px-3 py-2.5 font-medium">Pembayaran</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">
                Langkah berikutnya
              </th>
            </tr>
          </thead>
          {laneInvoices.length ? (
            laneInvoices.map((invoice) => {
              const status = asText(invoice.status);
              const paid = invoicePaid(invoice);
              const total = asNumber(invoice.nilai);
              const outstanding = Math.max(total - paid, 0);
              const issued = [
                "diterbitkan",
                "dibayar_sebagian",
                "lunas",
              ].includes(status);
              const nextStatus =
                status === "draft"
                  ? "diverifikasi"
                  : status === "diverifikasi"
                    ? "diterbitkan"
                    : "";
              const nextLabel =
                status === "draft"
                  ? "Verifikasi"
                  : status === "diverifikasi"
                    ? "Terbitkan tagihan"
                    : "";
              const linkedShipments = invoiceShipments(invoice);
              const paymentRows = rows(invoice.pembayaran);
              const context = { ...invoice, _targetStatus: nextStatus };
              return (
                <tbody key={asText(invoice.id)} className="divide-y">
                  <tr className="bg-background">
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-foreground">
                        {asText(invoice.nomor) || "Tagihan"}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {asText(invoice.pihak)}
                        </span>
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {linkedShipments.length
                          ? linkedShipments.map(shipmentName).join(", ")
                          : "Kargo belum ditautkan"}
                      </p>
                      {invoice.kontrakId ? (
                        <p className="mt-1 text-muted-foreground">
                          Kontrak{" "}
                          {asText(entity(invoice.kontrak).nomor) ||
                            asText(invoice.kontrakId).slice(0, 8)}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top font-medium">
                      {money(total, invoice.mataUang)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      {date(invoice.jatuhTempo)}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <p>{money(paid, invoice.mataUang)} dibayar</p>
                      <p className="mt-1 text-muted-foreground">
                        Sisa {money(outstanding, invoice.mataUang)}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <StatusPill value={status} />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {nextLabel && updateOperation ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={!active || locked}
                            onClick={() =>
                              onOpen(
                                { ...updateOperation, title: nextLabel },
                                {
                                  ...context,
                                  status: nextStatus,
                                  diterbitkanPada:
                                    nextStatus === "diterbitkan"
                                      ? new Date().toISOString().slice(0, 10)
                                      : invoice.diterbitkanPada,
                                },
                              )
                            }
                          >
                            {nextLabel}
                          </Button>
                        ) : null}
                        {issued && status !== "lunas" && paymentOperation ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!active || locked}
                            onClick={() => onOpen(paymentOperation, invoice)}
                          >
                            Catat pembayaran
                          </Button>
                        ) : null}
                        {issued && updateOperation ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={!active || locked || status === "lunas"}
                            onClick={() =>
                              onOpen(
                                {
                                  ...updateOperation,
                                  title: "Perbarui tanggal tagihan",
                                },
                                { ...invoice, status },
                              )
                            }
                          >
                            Ubah tanggal
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {paymentRows.map((payment) => {
                    const paymentStatus = asText(payment.status);
                    const nextPaymentStatus =
                      paymentStatus === "draft"
                        ? "aktif"
                        : paymentStatus === "aktif"
                          ? "selesai"
                          : "";
                    const paymentTitle =
                      paymentStatus === "draft"
                        ? direction === "masuk"
                          ? "Cocokkan penerimaan"
                          : "Setujui / proses"
                        : direction === "masuk"
                          ? "Konfirmasi dana diterima"
                          : "Konfirmasi transfer";
                    return (
                      <tr
                        key={asText(payment.id)}
                        className="bg-muted/15 text-muted-foreground"
                      >
                        <td className="py-2 pl-8 pr-3">
                          <span className="font-medium text-foreground">
                            Pembayaran {asText(payment.nomor)}
                          </span>
                          <span className="ml-2">
                            {payment.rekeningTujuan
                              ? `Referensi ${asText(payment.rekeningTujuan)}`
                              : ""}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {money(payment.nilai, payment.mataUang)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {date(payment.dibayarPada)}
                        </td>
                        <td className="px-3 py-2">
                          {paymentStatus === "selesai"
                            ? "Sudah dikonfirmasi"
                            : "Belum dikonfirmasi"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill value={paymentStatus} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          {nextPaymentStatus && paymentStatusOperation ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={!active || locked}
                              onClick={() =>
                                onOpen(
                                  {
                                    ...paymentStatusOperation,
                                    title: paymentTitle,
                                  },
                                  {
                                    ...payment,
                                    _targetStatus: nextPaymentStatus,
                                    dibayarPada:
                                      nextPaymentStatus === "selesai"
                                        ? new Date().toISOString().slice(0, 10)
                                        : payment.dibayarPada,
                                  },
                                )
                              }
                            >
                              {paymentTitle}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })
          ) : (
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-7 text-center text-muted-foreground"
                >
                  Belum ada tagihan di alur ini. Tagihan dapat dicatat setelah
                  dokumen dan dasar penagihannya tersedia.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </section>
  );
}

export function SettlementChecklist({
  active,
  locked,
  operations,
  planning,
  invoices,
  shipments,
  payments,
  claims,
  reconciliation,
  totals,
  totalsLoading = false,
  totalsError,
  documentRequirements,
  readiness,
  onOpen,
}: SettlementChecklistProps) {
  const operation = (key: string) =>
    operations.find((item) => item.key === key);
  const requiredIncoming =
    planning.modelPelaksanaan === "pengelolaan_manajemen_impor";
  const activeInvoices = invoices.filter(
    (invoice) => !["ditolak", "dibatalkan"].includes(asText(invoice.status)),
  );
  const unsupportedRecipientInvoices = requiredIncoming
    ? []
    : activeInvoices.filter((invoice) => invoice.arah === "masuk");
  const relevantInvoices = requiredIncoming
    ? activeInvoices
    : activeInvoices.filter((invoice) => invoice.arah === "keluar");
  const requiredInvoiceDirections = requiredIncoming
    ? (["masuk", "keluar"] as const)
    : (["keluar"] as const);
  const featuredInvoiceDirection = requiredInvoiceDirections.find(
    (direction) => !activeInvoices.some((invoice) => invoice.arah === direction),
  );
  const featuredInvoiceOperation = operation("tagihan");
  const reconciliationReadiness = getReconciliationReadiness(
    planning,
    invoices,
    shipments,
    claims,
  );
  const financeRows = rows(totals.financial);
  const quantityRows = rows(totals.quantityDeltas);
  const requiredDocs = documentRequirements.filter(
    (item) => item.wajib === true,
  );
  const unresolvedClaims = claims.filter(
    (claim) =>
      !["selesai", "ditolak", "dibatalkan"].includes(asText(claim.status)),
  );
  const documentsReady = requiredDocs.every((doc) => doc.terpenuhi === true);
  const claimsReady = reconciliationReadiness.claimsReady;
  const reconciliationReady = asText(reconciliation?.status) === "selesai";
  const financialReady = reconciliationReadiness.financialReady;
  const ready = readiness?.ready === true;

  return (
    <section
      className="overflow-hidden rounded-xl border bg-background"
      aria-label="Checklist settlement"
    >
      <header className="border-b bg-muted/20 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              Penyelesaian tagihan dan pembayaran
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              {requiredIncoming
                ? "Model Pengelolaan/Manajemen Impor: catat tagihan kepada Penerima Pasokan sesuai perjanjian, lalu pembayaran kepada Penyedia. Keduanya jalur terpisah."
                : "Model Pelaksanaan Impor Langsung: Lemigas menjadi importir. Catat tagihan dari Penyedia dan pembayaran kepada Penyedia; tidak ada tagihan kepada Penerima Pasokan."} Catat transaksi per tagihan; status pembayaran dihitung dari pembayaran yang dikonfirmasi.
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
          >
            {ready ? "Siap diselesaikan" : "Masih berjalan"}
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            {
              label: "Tagihan dan pembayaran",
              done: financialReady,
              note: `${relevantInvoices.length} tagihan relevan · ${payments.length} pembayaran`,
            },
            {
              label: "Rekonsiliasi akhir",
              done: reconciliationReady,
              note: reconciliationReady
                ? "Sudah difinalisasi"
                : "Tinjau hasil sebelum finalisasi",
            },
            {
              label: "Dokumen wajib",
              done: documentsReady,
              note: `${requiredDocs.filter((doc) => doc.terpenuhi === true).length}/${requiredDocs.length} terpenuhi`,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full ${item.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}
              >
                {item.done ? <Check size={14} /> : <CircleAlert size={14} />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {item.note}
                </span>
              </span>
            </div>
          ))}
        </div>
      </header>

      {featuredInvoiceDirection && featuredInvoiceOperation ? (
        <section
          className="mx-4 mt-4 rounded-xl border border-primary/25 bg-primary/[0.035] p-4 sm:mx-5 sm:p-5"
          aria-label="Langkah tagihan berikutnya"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <FileText size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  Mulai di sini · {relevantInvoices.length ? "Langkah berikutnya" : "Langkah pertama"}
                </p>
                <h3 className="mt-1 text-base font-semibold">
                  {featuredInvoiceDirection === "masuk"
                    ? "Catat tagihan dari Penerima Pasokan"
                    : "Catat tagihan dari Penyedia"}
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
                  {featuredInvoiceDirection === "masuk"
                    ? "Mulai dengan mencatat tagihan sesuai perjanjian atau komitmen. Setelah itu, catat pembayaran kepada Penyedia pada jalur berikutnya."
                    : "Catat tagihan berdasarkan kontrak Penyedia dan kargo terkait. Setelah disimpan, verifikasi dan terbitkan tagihan, lalu catat pembayarannya."}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="default"
              className="shrink-0"
              disabled={!active || locked}
              onClick={() =>
                onOpen(featuredInvoiceOperation, {
                  arah: featuredInvoiceDirection,
                })
              }
            >
              <Plus size={16} /> Catat tagihan
            </Button>
          </div>
        </section>
      ) : null}

      {unsupportedRecipientInvoices.length ? (
        <div role="alert" className="mx-4 mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 sm:mx-5">
          Ada {unsupportedRecipientInvoices.length} tagihan Penerima Pasokan aktif dari data lama. Pada model impor langsung tagihan ini harus dibatalkan sebelum rekonsiliasi.
        </div>
      ) : null}
      {requiredIncoming ? (
        <>
          <InvoiceLane
            title="Tagihan kepada Penerima Pasokan"
            description="Terbitkan tagihan berdasarkan perjanjian kerja sama atau komitmen tertulis, termasuk biaya yang memang dapat ditagihkan. Nilai acuan kargo bukan otomatis nilai akhir tagihan."
            direction="masuk"
            required
            invoices={invoices}
            operation={operation("tagihan")}
            updateOperation={operation("status-tagihan")}
            paymentOperation={operation("pembayaran")}
            paymentStatusOperation={operation("status-pembayaran")}
            active={active}
            locked={locked}
            hideAddAction={featuredInvoiceDirection === "masuk"}
            onOpen={onOpen}
          />
          <div className="border-t" />
        </>
      ) : null}
      <InvoiceLane
        title="Pembayaran kepada Penyedia"
        description="Verifikasi tagihan Penyedia terhadap kontrak dan dokumen kargo, lalu catat pembayaran sesuai kewenangan."
        direction="keluar"
        required
        invoices={invoices}
        operation={operation("tagihan")}
        updateOperation={operation("status-tagihan")}
        paymentOperation={operation("pembayaran")}
        paymentStatusOperation={operation("status-pembayaran")}
        active={active}
        locked={locked}
        hideAddAction={featuredInvoiceDirection === "keluar"}
        onOpen={onOpen}
      />

      <section className="border-t px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Klaim dan tindak lanjut</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Catat saat ada selisih atau keberatan. Klaim yang belum selesai
              bisa dibawa ke pemantauan setelah transaksi dengan penanggung
              jawab dan tanggal tindak lanjut.
            </p>
          </div>
          {operation("klaim") ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!active || locked}
              onClick={() => onOpen(operation("klaim")!)}
            >
              <Plus size={15} /> Catat klaim
            </Button>
          ) : null}
        </div>
        {claims.length ? (
          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Klaim</th>
                  <th className="px-3 py-2.5 font-medium">Terkait</th>
                  <th className="px-3 py-2.5 font-medium">Nilai</th>
                  <th className="px-3 py-2.5 font-medium">
                    Status / tindak lanjut
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {claims.map((claim) => (
                  <tr key={asText(claim.id)}>
                    <td className="px-3 py-3">
                      <p className="font-semibold">
                        {asText(claim.nomor)} · {asText(claim.kategori)}
                      </p>
                      <p className="mt-1 max-w-lg whitespace-pre-wrap text-muted-foreground">
                        {asText(claim.uraian)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {asText(claim.pengirimanId)
                        ? shipmentName(
                            shipments.find(
                              (shipment) => shipment.id === claim.pengirimanId,
                            ) ?? {},
                          )
                        : asText(claim.tagihanId)
                          ? asText(
                              invoices.find(
                                (invoice) => invoice.id === claim.tagihanId,
                              )?.nomor,
                            ) || "Tagihan"
                          : "Transaksi"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {claim.nilai == null
                        ? "—"
                        : money(claim.nilai, claim.mataUang)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill value={claim.status} />
                      {claim.tetapDipantau === true ? (
                        <>
                          <p className="mt-1 text-muted-foreground">
                            Dipantau oleh {asText(claim.penanggungJawab)} ·{" "}
                            {date(claim.tindakLanjutPada)}
                          </p>
                          <p className="mt-1 max-w-sm whitespace-pre-wrap text-muted-foreground">
                            {asText(claim.tindakLanjut)}
                          </p>
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {operation("status-klaim") &&
                      !["selesai", "ditolak", "dibatalkan"].includes(
                        asText(claim.status),
                      ) ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={!active || locked}
                          onClick={() =>
                            onOpen(operation("status-klaim")!, {
                              ...claim,
                              _targetStatus:
                                claim.status === "draft"
                                  ? "aktif"
                                  : claim.status,
                            })
                          }
                        >
                          {claim.tetapDipantau === true
                            ? "Perbarui tindak lanjut"
                            : "Tindak lanjuti"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Belum ada klaim terbuka. Bagian ini hanya digunakan jika ada selisih
            atau keberatan.
          </p>
        )}
        {unresolvedClaims.length ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {unresolvedClaims.length} klaim masih perlu diselesaikan atau diberi
            tindak lanjut pasca transaksi.
          </p>
        ) : null}
      </section>

      <section className="border-t bg-muted/10 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Rekonsiliasi</h3>
              {reconciliation ? (
                <StatusPill
                  value={reconciliation.status}
                  label={reconciliation.status === "aktif" ? "Sedang ditinjau" : reconciliation.status === "selesai" ? "Final" : "Snapshot tersimpan"}
                />
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Belum dimulai</span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pratinjau dihitung otomatis. Simpan snapshot setelah BAST per
              kargo lengkap, tagihan sesuai model sudah terbit dan lunas, serta
              klaim sudah selesai atau memiliki tindak lanjut.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {operation("rekonsiliasi") && !reconciliationReady ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!active || locked}
                onClick={() =>
                  onOpen(
                    {
                      ...operation("rekonsiliasi")!,
                      title: reconciliation
                        ? "Perbarui snapshot rekonsiliasi"
                        : "Tinjau ringkasan rekonsiliasi",
                    },
                  )
                }
              >
                <RefreshCw size={14} />
                {reconciliation?.status === "aktif"
                  ? "Perbarui snapshot"
                  : reconciliation
                    ? "Perbarui snapshot"
                    : "Tinjau ringkasan"}
              </Button>
            ) : null}
            {reconciliation && operation("status-rekonsiliasi") ? (
              <Button
                type="button"
                size="sm"
                disabled={
                  !active ||
                  locked ||
                  asText(reconciliation.status) === "selesai" ||
                  !reconciliationReadiness.ready ||
                  (asText(reconciliation.status) === "aktif" && !documentsReady)
                }
                onClick={() =>
                  onOpen(
                    {
                      ...operation("status-rekonsiliasi")!,
                      title:
                        asText(reconciliation.status) === "aktif"
                          ? "Finalisasi rekonsiliasi"
                          : "Mulai tinjau rekonsiliasi",
                    },
                    {
                      ...reconciliation,
                      status:
                        asText(reconciliation.status) === "aktif"
                          ? "selesai"
                          : "aktif",
                    },
                  )
                }
              >
                  {asText(reconciliation.status) === "aktif"
                    ? "Finalisasi rekonsiliasi"
                    : "Mulai tinjau"}
              </Button>
            ) : null}
          </div>
        </div>
        {!reconciliationReady && !reconciliationReadiness.ready ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-950">
            <p className="font-semibold">Ringkasan masih pratinjau</p>
            <p className="mt-1">Selesaikan hal berikut sebelum memulai peninjauan resmi:</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {reconciliationReadiness.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {reconciliation &&
        asText(reconciliation.status) === "aktif" &&
        (!financialReady || !documentsReady || !claimsReady || !reconciliationReadiness.deliveryReady) ? (
          <p className="mt-2 text-xs text-amber-700">
            Finalisasi menunggu{" "}
            {[
              !financialReady ? "tagihan dan pembayaran lunas" : "",
              !documentsReady ? "dokumen wajib" : "",
              !claimsReady ? "klaim ditutup atau tindak lanjutnya lengkap" : "",
            ]
              .filter(Boolean)
              .join(", ")}
            .
          </p>
        ) : null}
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="border-b px-3 py-2.5">
              <p className="text-xs font-semibold">Kuantitas per kargo</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Kargo</th>
                    <th className="px-3 py-2 font-medium">Rencana</th>
                    <th className="px-3 py-2 font-medium">Diterima</th>
                    <th className="px-3 py-2 font-medium">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quantityRows.map((row) => (
                    <tr key={asText(row.shipmentId)}>
                      <td className="px-3 py-2.5">
                        {asText(row.reference) || "Kargo"}
                      </td>
                      <td className="px-3 py-2.5">
                        {asText(row.planned) || "—"} {asText(row.unit)}
                      </td>
                      <td className="px-3 py-2.5">
                        {asText(row.accepted) || "—"} {asText(row.unit)}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-medium ${asNumber(row.acceptedMinusPlanned) !== 0 ? "text-amber-700" : "text-emerald-700"}`}
                      >
                        {asText(row.acceptedMinusPlanned) || "0"}{" "}
                        {asText(row.unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!quantityRows.length ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {totalsLoading
                    ? "Menghitung ringkasan…"
                    : "Belum ada perbandingan volume."}
                </p>
              ) : null}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="border-b px-3 py-2.5">
              <p className="text-xs font-semibold">
                Nilai per mata uang dan arah
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-muted/30 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Alur</th>
                    <th className="px-3 py-2 font-medium">Mata uang</th>
                    <th className="px-3 py-2 font-medium">Tagihan</th>
                    <th className="px-3 py-2 font-medium">Dibayar</th>
                    <th className="px-3 py-2 font-medium">Sisa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {financeRows.map((row) => (
                    <tr
                      key={`${asText(row.direction)}:${asText(row.currency)}`}
                    >
                      <td className="px-3 py-2.5">
                        {row.direction === "masuk"
                          ? "Penerima Pasokan"
                          : row.direction === "keluar"
                            ? "Penyedia"
                            : "Belum dipetakan"}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        {asText(row.currency)}
                      </td>
                      <td className="px-3 py-2.5">
                        {money(row.invoice, row.currency)}
                      </td>
                      <td className="px-3 py-2.5">
                        {money(row.payment, row.currency)}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.outstandingComparable === true
                          ? money(row.outstanding, row.currency)
                          : "Belum dapat dicocokkan"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!financeRows.length ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {totalsLoading
                    ? "Menghitung ringkasan…"
                    : "Ringkasan muncul setelah tagihan dan pembayaran dicatat."}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {totalsError ? (
          <p
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-xs text-destructive"
          >
            <CircleAlert size={13} /> Ringkasan otomatis gagal dimuat:{" "}
            {totalsError}
          </p>
        ) : null}
        {reconciliation?.catatan ? (
          <p className="mt-3 rounded-lg border bg-background p-3 text-xs">
            <strong>Catatan rekonsiliasi:</strong>{" "}
            {asText(reconciliation.catatan)}
          </p>
        ) : null}
        {reconciliation?.rincian ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileText size={13} /> Snapshot ringkasan tersimpan saat
            rekonsiliasi terakhir diperbarui.
          </p>
        ) : null}
        {readiness?.ready === false ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-950">
            <p className="font-semibold">Yang masih menghalangi penyelesaian</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {rows(readiness.blockers).map((blocker, index) => (
                <li key={`${index}:${asText(blocker.code)}`}>
                  {asText(blocker.message)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {readiness?.ready === true ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Check size={14} /> Semua prasyarat settlement sudah lengkap.
          </p>
        ) : null}
      </section>

      <div className="border-t bg-background px-4 py-3 sm:px-5">
        <p className="text-[11px] text-muted-foreground">
          Dokumen settlement yang wajib:{" "}
          {requiredDocs
            .map(
              (doc) =>
                `${asText(doc.jenisDokumen).replaceAll("_", " ")} ${doc.terpenuhi === true ? "✓" : "· belum"}`,
            )
            .join(" · ") || "belum dikonfigurasi"}
          . Unggah atau tautkan melalui bagian Dokumen pengadaan.
        </p>
        {shipments.length &&
        invoices.some((invoice) => !invoiceShipments(invoice).length) ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700">
            <CircleAlert size={12} /> Ada tagihan lama yang belum dikaitkan
            dengan kargo.
          </p>
        ) : null}
      </div>
    </section>
  );
}
