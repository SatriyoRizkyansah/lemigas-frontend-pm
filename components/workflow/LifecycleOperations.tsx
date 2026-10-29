"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Ban, Check, ClipboardList, FileCheck2, FileText, Handshake, Send, Settings2, Ship, Wallet, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { ReadDocumentButton, UploadDocumentField } from "@/components/documents/DocumentControls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { browserApi } from "@/lib/api/browser-client";
import { ContentType } from "@/lib/api/generated/api-generated";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { getApiErrorMessage } from "@/lib/api/errors";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { procurementMethodLabel } from "@/lib/procurement-methods";
import { lifecycleOperations, operationPayload, type Entity, type Field, type Operation } from "./lifecycle-operations-config";
import { getReconciliationReadiness, SettlementChecklist } from "./SettlementChecklist";

export type LifecycleOperationsProps = { pengadaanId: string; stage: string; active: boolean; detail: any };
type Choice = { value: string; label: string };
const shipmentStatusSteps = [
  { value: "direncanakan", label: "Direncanakan" },
  { value: "dimuat", label: "Dimuat" },
  { value: "dalam_perjalanan", label: "Dalam perjalanan" },
  { value: "tiba", label: "Tiba" },
  { value: "dibongkar", label: "Dibongkar" },
  { value: "diserahkan", label: "Diserahkan" },
] as const;
function shipmentStatusLabel(value: string) {
  return shipmentStatusSteps.find((step) => step.value === value)?.label ?? (value === "bermasalah" ? "Bermasalah" : value.replaceAll("_", " "));
}
function nextShipmentStatus(value: string) {
  const index = shipmentStatusSteps.findIndex((step) => step.value === value);
  return index >= 0 ? shipmentStatusSteps[index + 1]?.value : undefined;
}
function object(value: unknown): Entity {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Entity) : {};
}
function unwrap(value: unknown): unknown {
  let current = value;
  for (let depth = 0; depth < 3 && current && typeof current === "object" && "data" in current; depth++) current = (current as Entity).data;
  return current;
}
function records(value: unknown): Entity[] {
  return Array.isArray(value) ? value.map(object) : [];
}
function shipmentHandoverComplete(shipment: Entity | undefined) {
  if (!shipment) return false;
  const expected = Number(object(shipment.penerimaan).kuantitasDiterima);
  if (!Number.isFinite(expected) || expected <= 0) return false;
  const accepted = records(shipment.serahTerima).filter((row) => row.status !== "ditolak");
  const handedOver = accepted.reduce((total, row) => total + Math.round(Number(row.kuantitasDiserahkan ?? 0) * 10_000), 0) / 10_000;
  return Math.abs(handedOver - expected) < 0.00005;
}
function invoiceSuggestion(shipmentIds: string[], direction: string, detail: Entity) {
  const shipments = records(detail.pengiriman).filter((shipment) => shipmentIds.includes(String(shipment.id)));
  const contractIds = [...new Set(shipments.map((shipment) => String(shipment.kontrakId ?? object(shipment.kontrak).id ?? "")).filter(Boolean))];
  const mixedContracts = contractIds.length > 1;
  const candidateContract = !mixedContracts && contractIds.length === 1
    ? records(detail.kontrak).find((row) => String(row.id) === contractIds[0])
    : undefined;
  const contract = candidateContract && ["efektif", "dipenuhi"].includes(String(candidateContract.status)) && candidateContract.jenis === "penyedia" ? candidateContract : undefined;
  const volume = shipments.reduce((total, shipment) => {
    const accepted = object(shipment.penerimaan).kuantitasDiterima;
    const planned = shipment.volumeRencana ?? shipment.volumeKontrak;
    const acceptedQuantity = Number(accepted);
    const quantity = Number.isFinite(acceptedQuantity) && acceptedQuantity > 0 ? acceptedQuantity : Number(planned ?? 0);
    return total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
  }, 0);
  const volumeBasis = shipments.length > 0 && shipments.every((shipment) => Number(object(shipment.penerimaan).kuantitasDiterima) > 0)
    ? "volume BAST"
    : "volume BAST/rencana";
  const contractVolume = contract?.volumeKontrak == null ? Number.NaN : Number(contract.volumeKontrak);
  const contractValue = contract?.nilai == null ? Number.NaN : Number(contract.nilai);
  const suggestedValue = contract && contractVolume > 0 && Number.isFinite(contractValue)
    ? Number((contractValue * volume / contractVolume).toFixed(4))
    : undefined;
  const providerName = plainText(object(contract?.vendor).nama);
  const planning = object(detail.perencanaan);
  return {
    contract,
    contractNotEffective: Boolean(candidateContract && !["efektif", "dipenuhi"].includes(String(candidateContract.status))),
    contractId: contract ? String(contract.id) : "",
    mixedContracts,
    volume,
    volumeBasis,
    suggestedValue,
    currency: plainText(contract?.mataUang),
    party: direction === "keluar" ? providerName : plainText(planning.penerimaPasokan),
    contractNumber: plainText(contract?.nomor),
    priceType: plainText(contract?.jenisHarga),
    unit: plainText(contract?.satuanKontrak) || plainText(planning.satuan),
    shipmentCount: shipments.length,
  };
}
function parseParameterRows(value: string): Array<{ name: string; value: string }> {
  const rows = value
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const separator = line.indexOf(":");
      return separator < 0 ? { name: line.trim(), value: "" } : { name: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim() };
    });
  return rows.length ? rows : [{ name: "", value: "" }];
}
function serializeParameterRows(rows: Array<{ name: string; value: string }>): string {
  return rows.map((row) => `${row.name}: ${row.value}`).join("\n");
}
function normalizedTerm(terms: Entity, key: string): unknown {
  const value = terms[key];
  const nested = object(value);
  return Object.prototype.hasOwnProperty.call(nested, key) ? nested[key] : value;
}
function parameterText(value: unknown): string {
  const entries = Object.entries(object(value));
  return entries.map(([name, item]) => `${name}: ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
}
function documentRequirementText(value: unknown): string {
  if (!Array.isArray(value)) return parameterText(value);
  return value
    .map((entry) => {
      const document = object(entry);
      const name = plainText(document.nama);
      const details = [document.wajib ? "Wajib" : "Opsional", plainText(document.keterangan)].filter((detail) => detail && detail !== "—").join("; ");
      return name ? `${name}: ${details}` : "";
    })
    .filter(Boolean)
    .join("\n");
}
function plainText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value == null) return "";
  const entries = Object.entries(object(value));
  if (entries.length === 1 && typeof entries[0][1] === "string") return entries[0][1] as string;
  return JSON.stringify(value);
}
function cleanParameterRows(value: string): string {
  return parseParameterRows(value)
    .filter((row) => row.name.trim() || row.value.trim())
    .map((row) => `${row.name}: ${row.value}`)
    .join("\n");
}
function choices(rows: Entity[]): Choice[] {
  return rows.filter((row) => typeof row.id === "string").map((row) => ({ value: String(row.id), label: [row.nomor ?? row.nama ?? row.namaKapal ?? row.nomorBillOfLading ?? row.jenis ?? row.id].filter(Boolean).join(" · ") }));
}
function quantityUnits(value: unknown): number {
  const quantity = Number(value);
  return Number.isFinite(quantity) ? Math.round(quantity * 10_000) : 0;
}
function quantityDiffers(left: unknown, right: unknown): boolean {
  return left != null && right != null && quantityUnits(left) !== quantityUnits(right);
}
function formatQuantity(value: unknown, unit?: unknown): string {
  if (value == null || value === "") return "Belum dicatat";
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return "Belum dicatat";
  const formatted = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(quantity);
  const suffix = plainText(unit);
  return suffix ? `${formatted} ${suffix}` : formatted;
}
function allocatedVolume(shipments: Entity[], contractId: string, excludeShipmentId?: string): number {
  return shipments
    .filter((shipment) => String(shipment.kontrakId ?? object(shipment.kontrak).id ?? "") === contractId && String(shipment.id ?? "") !== excludeShipmentId)
    .reduce((total, shipment) => total + quantityUnits(shipment.volumeRencana), 0) / 10_000;
}
function remainingContractVolume(contract: Entity, shipments: Entity[], excludeShipmentId?: string): number | null {
  const target = Number(contract.volumeKontrak);
  if (!Number.isFinite(target) || target <= 0) return null;
  return target - allocatedVolume(shipments, String(contract.id ?? ""), excludeShipmentId);
}
function contractChoices(rows: Entity[], shipments: Entity[], excludeShipmentId?: string): Choice[] {
  return rows
    .filter((row) => typeof row.id === "string")
    .map((row) => {
      const number = plainText(row.nomor);
      const vendor = plainText(object(row.vendor).nama);
      const status = plainText(row.status).replaceAll("_", " ");
      const remaining = remainingContractVolume(row, shipments, excludeShipmentId);
      const quantity = Number(row.volumeKontrak) > 0 ? `Target ${formatQuantity(row.volumeKontrak, row.satuanKontrak)} · sisa ${formatQuantity(remaining, row.satuanKontrak)}` : "Volume kontrak belum diatur";
      return {
        value: String(row.id),
        label: [number ? `Kontrak ${number}` : "Kontrak tanpa nomor", vendor, status, quantity].filter(Boolean).join(" · "),
      };
    });
}
function shipmentChoices(rows: Entity[]): Choice[] {
  return rows
    .filter((row) => typeof row.id === "string")
    .map((row) => {
      const vessel = plainText(row.namaKapal);
      const bill = plainText(row.nomorBillOfLading);
      const route = [plainText(row.pelabuhanMuat), plainText(row.pelabuhanBongkar)].filter(Boolean).join(" → ");
      const contractNumber = plainText(object(row.kontrak).nomor);
      const plan = row.volumeRencana == null ? "" : `Rencana ${formatQuantity(row.volumeRencana, object(row.kontrak).satuanKontrak)}`;
      const identity = vessel || (bill ? `B/L ${bill}` : "") || route || "Kargo tanpa identitas";
      return { value: String(row.id), label: [identity, bill && vessel ? `B/L ${bill}` : "", contractNumber ? `Kontrak ${contractNumber}` : "", plan, plainText(row.status).replaceAll("_", " ")].filter(Boolean).join(" · ") };
    });
}
function operationFieldSections(operationKey: string | undefined, fields: Field[]): Array<{ title: string; fields: Field[] }> {
  const sections: Record<string, { title: string; fields: string[] }[]> = {
    rfq: [
      { title: "Informasi RFQ", fields: ["mode", "vendorIds", "rfqId", "rfqIds", "nomor", "alasanPerubahan", "batasRespons"] },
      { title: "Kebutuhan dan ketentuan", fields: ["spesifikasi", "volume", "satuan", "titikSerah", "syaratPenyerahan", "syaratPembayaran", "dokumenDiminta"] },
    ],
    perencanaan: [
      { title: "Informasi kebutuhan", fields: ["modelPelaksanaan", "jenisKargo", "satuan", "titikSerah", "nomorPenugasan", "penerimaPasokan"] },
      { title: "Spesifikasi dan kesiapan penerima", fields: ["spesifikasiMutu", "kesiapanPenerima"] },
      { title: "Volume dan jadwal", fields: ["volumeMin", "volumeMax", "estimasiMulai", "estimasiSelesai"] },
    ],
    strategi: [
      { title: "Metode transaksi", fields: ["jenisTransaksi", "metodeSeleksi"] },
      { title: "Analisis dan strategi", fields: ["analisisPasar", "dasarPemilihan", "strategiPengiriman", "strategiPembiayaan"] },
    ],
    tagihan: [{ title: "Rincian tagihan", fields: ["nomor", "arah", "pengirimanIds", "pihak", "kontrakId", "nilai", "mataUang", "jatuhTempo"] }],
    rekonsiliasi: [{ title: "Kesimpulan dan keputusan", fields: ["catatan"] }],
    negosiasi: [{ title: "Detail negosiasi", fields: ["penawaranId", "batasNegosiasi", "hargaHasilNegosiasi", "hasil"] }],
    pengiriman: [{ title: "Informasi pengiriman", fields: ["kontrakId", "namaKapal", "nomorBillOfLading", "pelabuhanMuat", "pelabuhanBongkar", "etd", "eta", "volumeRencana"] }],
    "update-pengiriman": [{ title: "Informasi pengiriman", fields: ["entityId", "kontrakId", "namaKapal", "nomorBillOfLading", "pelabuhanMuat", "pelabuhanBongkar", "etd", "eta", "volumeRencana"] }],
    "status-pengiriman": [{ title: "Status dan realisasi pengapalan", fields: ["entityId", "status", "volumeAktual"] }],
    risiko: [{ title: "Detail kejadian", fields: ["pengirimanId", "deskripsi", "tingkat", "mitigasi"] }],
    pemeriksaan: [{ title: "Detail pemeriksaan", fields: ["pengirimanId", "tipe", "tanggalPeriksa", "surveyor", "hasilKuantitas", "hasilMutu", "nomorSertifikat", "diterimaDenganCatatan", "catatan"] }],
    penerimaan: [{ title: "Detail penerimaan / BAST", fields: ["pengirimanId", "tanggalTerima", "titikSerah", "nomorBast", "kuantitasDiterima", "mutuDiterima", "denganCatatan", "catatan"] }],
    penyimpanan: [{ title: "Catatan persediaan", fields: ["fasilitas", "penerimaanId", "satuan", "lokasi", "kuantitasMasuk", "kuantitasKeluar", "catatan"] }],
    "serah-terima": [{ title: "Detail penyerahan kepada Penerima Pasokan", fields: ["pengirimanId", "nomorDokumen", "tanggalSerah", "penerimaPasokan", "titikSerah", "kuantitasDiserahkan", "satuan", "status", "catatan"] }],
  };
  const configured = sections[operationKey ?? ""];
  if (!configured) return [{ title: "Informasi", fields }];
  const grouped = configured.map((section) => ({ title: section.title, fields: fields.filter((field) => section.fields.includes(field.name)) })).filter((section) => section.fields.length);
  const assigned = new Set(grouped.flatMap((section) => section.fields.map((field) => field.name)));
  const remaining = fields.filter((field) => !assigned.has(field.name));
  if (remaining.length) grouped.push({ title: "Informasi tambahan", fields: remaining });
  return grouped;
}

function deliveryDate(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "—" : new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" }).format(parsed);
}

function DeliveryChecklist({ active, locked, operations, contracts, shipments, storage, risks, planning, onOpen }: {
  active: boolean; locked: boolean; operations: Operation[]; shipments: Entity[]; storage: Entity[]; risks: Entity[];
  contracts: Entity[]; planning: Entity;
  onOpen: (operation: Operation, context?: Entity) => void;
}) {
  const operation = (key: string) => operations.find((item) => item.key === key);
  const inspectionDone = (shipment: Entity) => records(shipment.pemeriksaan).length > 0;
  const receptionDone = (shipment: Entity) => Boolean(shipment.penerimaan);
  const unloadingDone = (shipment: Entity) => String(shipment.status ?? "") === "dibongkar";
  const hasReachedDischarge = (shipment: Entity) => ["dibongkar", "diserahkan"].includes(String(shipment.status ?? ""));
  const deliveredQuantity = (shipment: Entity) =>
    records(shipment.serahTerima)
      .filter((row) => row.status !== "ditolak")
      .reduce((total, row) => total + Math.round(Number(row.kuantitasDiserahkan ?? 0) * 10_000), 0) / 10_000;
  const handoverDone = shipmentHandoverComplete;
  const completed = shipments.filter((shipment) => inspectionDone(shipment) && receptionDone(shipment) && handoverDone(shipment)).length;
  const effectiveContracts = contracts.filter((contract) => contract.jenis === "penyedia" && contract.status === "efektif");
  const modelPelaksanaan = plainText(planning.modelPelaksanaan);
  const pihakImportir = plainText(planning.pihakImportir);
  const importerName = pihakImportir === "pihak_lain"
    ? plainText(planning.namaImportir) || "Pihak lain belum diberi nama"
    : pihakImportir === "penerima_pasokan"
      ? "Penerima Pasokan"
      : pihakImportir === "lemigas" || modelPelaksanaan === "pelaksanaan_impor_langsung"
        ? "Lemigas"
        : "Belum ditetapkan";
  const action = (key: string, label: string, context?: Entity, unavailable = false) => {
    const item = operation(key);
    return item ? <Button type="button" size="sm" variant="outline" disabled={!active || locked || unavailable} onClick={() => onOpen(item, context)}>{label}</Button> : null;
  };
  const checklistRow = (number: string, title: string, detail: string, done: boolean, control?: React.ReactNode, optional = false) => (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${done ? "bg-emerald-600 text-white" : optional ? "bg-muted text-muted-foreground" : "border text-muted-foreground"}`}>
          {done ? <Check size={13} /> : number}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2 text-sm font-medium">{title}{optional ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Opsional</span> : null}</span>
          <span className="block text-xs text-muted-foreground">{detail}</span>
        </span>
      </div>
      {control}
    </div>
  );
  return (
    <section className="space-y-3" aria-label="Checklist pelaksanaan delivery">
      <section className="rounded-xl border bg-muted/15 px-4 py-3" aria-label="Tanggung jawab pelaksanaan impor">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Model pelaksanaan dan tanggung jawab dokumen</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {modelPelaksanaan === "pelaksanaan_impor_langsung"
                ? "Lemigas bertindak sebagai importir dan menyiapkan dokumen impor/kepabeanan sesuai kewenangannya. Settlement hanya memiliki jalur pembayaran kepada Penyedia."
                : modelPelaksanaan === "pengelolaan_manajemen_impor"
                  ? "Pihak importir mengikuti perjanjian kerja sama. Dokumen impor/kepabeanan dilengkapi oleh importir yang ditetapkan; settlement mencatat tagihan Penerima Pasokan dan pembayaran kepada Penyedia."
                  : "Model pelaksanaan belum tercatat. Lengkapi Perencanaan sebelum melanjutkan alokasi dan dokumen kargo."}
            </p>
          </div>
          <span className="rounded-full border bg-background px-2.5 py-1 text-xs font-medium">Importir: {importerName}</span>
        </div>
        <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          Unggah bukti di Dokumen tahap: Perjanjian/komitmen Penerima Pasokan pada Perencanaan (khusus manajemen impor), lalu dokumen impor dan kepabeanan pada Delivery.
        </p>
      </section>
      <section className="overflow-hidden rounded-xl border bg-background">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div><h3 className="text-sm font-semibold">Pengapalan dan pemantauan</h3><p className="mt-1 text-xs text-muted-foreground">Alokasi seluruh kargo mengikuti volume kontrak. Setiap pengiriman punya progres sendiri.</p></div>
          {action("pengiriman", "Catat pengiriman")}
        </header>
        {effectiveContracts.length ? (
          <div className="overflow-x-auto border-b">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/10 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Kontrak</th><th className="px-4 py-2.5 text-right font-medium">Volume kontrak</th><th className="px-4 py-2.5 text-right font-medium">Dialokasikan</th><th className="px-4 py-2.5 text-right font-medium">Sisa rencana</th><th className="px-4 py-2.5 text-right font-medium">Diterima (BAST)</th><th className="px-4 py-2.5 text-right font-medium">Selisih penerimaan</th></tr></thead>
              <tbody className="divide-y">{effectiveContracts.map((contract) => {
                const contractId = String(contract.id);
                const related = shipments.filter((shipment) => String(shipment.kontrakId ?? object(shipment.kontrak).id ?? "") === contractId);
                const allocated = allocatedVolume(shipments, contractId);
                const targetValue = Number(contract.volumeKontrak);
                const target = Number.isFinite(targetValue) && targetValue > 0 ? targetValue : null;
                const received = related.reduce((total, shipment) => total + quantityUnits(object(shipment.penerimaan).kuantitasDiterima), 0) / 10_000;
                const hasReceiptQuantity = related.some((shipment) => object(shipment.penerimaan).kuantitasDiterima != null);
                const remaining = target == null ? null : target - allocated;
                const variance = target == null || !hasReceiptQuantity ? null : received - target;
                return <tr key={contractId}>
                  <td className="px-4 py-3"><p className="font-medium">Kontrak {plainText(contract.nomor) || "—"}</p><p className="mt-0.5 text-xs text-muted-foreground">{plainText(object(contract.vendor).nama) || "Vendor"}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatQuantity(target, contract.satuanKontrak)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{formatQuantity(allocated, contract.satuanKontrak)}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right ${remaining != null && remaining < -0.00005 ? "font-medium text-destructive" : remaining != null && remaining > 0.00005 ? "font-medium text-amber-700 dark:text-amber-300" : ""}`}>{formatQuantity(remaining, contract.satuanKontrak)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">{hasReceiptQuantity ? formatQuantity(received, contract.satuanKontrak) : "Belum dicatat"}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right ${variance != null && Math.abs(variance) > 0.00005 ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{variance != null && variance > 0 ? "+" : ""}{formatQuantity(variance, contract.satuanKontrak)}</td>
                </tr>;
              })}</tbody>
            </table>
            <p className="px-4 py-2 text-xs text-muted-foreground">Selisih penerimaan wajib dijelaskan pada catatan BAST. Tahap Delivery hanya dapat diselesaikan jika alokasi rencana sama dengan volume kontrak.</p>
          </div>
        ) : null}
        {shipments.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[1190px] text-left text-sm">
            <thead className="bg-muted/10 text-xs text-muted-foreground"><tr><th className="px-4 py-2.5 font-medium">Kargo / kapal</th><th className="px-4 py-2.5 font-medium">Bill of lading</th><th className="px-4 py-2.5 text-right font-medium">Volume rencana</th><th className="px-4 py-2.5 text-right font-medium">Realisasi pengapalan</th><th className="px-4 py-2.5 text-right font-medium">Hasil pemeriksaan</th><th className="px-4 py-2.5 text-right font-medium">Diterima (BAST)</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">ETA</th><th className="px-4 py-2.5 text-right font-medium">Aksi</th></tr></thead>
            <tbody className="divide-y">{shipments.map((shipment) => <tr key={String(shipment.id)}>
              <td className="px-4 py-3"><p className="font-medium">{plainText(shipment.namaKapal) || "Pengiriman"}</p><p className="mt-0.5 text-xs text-muted-foreground">Kontrak {plainText(object(shipment.kontrak).nomor) || "—"}</p></td>
              <td className="px-4 py-3 text-muted-foreground">{plainText(shipment.nomorBillOfLading) || "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 text-right">{formatQuantity(shipment.volumeRencana, object(shipment.kontrak).satuanKontrak)}</td>
              <td className={`whitespace-nowrap px-4 py-3 text-right ${quantityDiffers(shipment.volumeAktual, shipment.volumeRencana) ? "font-medium text-amber-700 dark:text-amber-300" : ""}`}>{formatQuantity(shipment.volumeAktual, object(shipment.kontrak).satuanKontrak)}</td>
              <td className={`whitespace-nowrap px-4 py-3 text-right ${quantityDiffers(records(shipment.pemeriksaan).slice(-1)[0]?.hasilKuantitas, shipment.volumeRencana) ? "font-medium text-amber-700 dark:text-amber-300" : ""}`}>{formatQuantity(records(shipment.pemeriksaan).slice(-1)[0]?.hasilKuantitas, object(shipment.kontrak).satuanKontrak)}</td>
              <td className={`whitespace-nowrap px-4 py-3 text-right ${quantityDiffers(object(shipment.penerimaan).kuantitasDiterima, shipment.volumeRencana) ? "font-medium text-amber-700 dark:text-amber-300" : ""}`}>{formatQuantity(object(shipment.penerimaan).kuantitasDiterima, object(shipment.kontrak).satuanKontrak)}</td>
              <td className="px-4 py-3"><span className="rounded-full bg-muted px-2 py-1 text-xs font-medium capitalize">{(plainText(shipment.status) || "direncanakan").replaceAll("_", " ")}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{deliveryDate(shipment.eta)}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-2">{action("update-pengiriman", "Edit detail", shipment)}{action("status-pengiriman", shipment.status === "bermasalah" ? "Pulihkan status" : shipment.status === "diserahkan" && handoverDone(shipment) ? "Lihat progres" : shipment.status === "diserahkan" ? "Koreksi status" : shipment.status === "dibongkar" && !handoverDone(shipment) ? "Lihat progres" : "Lanjut tahap", shipment)}</div></td>
            </tr>)}</tbody>
          </table></div>
        ) : <div className="px-4 py-6 text-center"><p className="text-sm font-medium">Belum ada pengiriman tercatat</p><p className="mt-1 text-xs text-muted-foreground">Catat kargo terlebih dahulu untuk membuka checklist operasionalnya.</p></div>}
      </section>

      <section className="overflow-hidden rounded-xl border bg-background">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
          <div><h3 className="text-sm font-semibold">Penerimaan dan serah-terima per kargo</h3><p className="mt-1 text-xs text-muted-foreground">Pemeriksaan mengikuti titik dalam kontrak. BAST menunggu pembongkaran, penyimpanan opsional setelah BAST, lalu serah-terima kepada penerima.</p></div>
          <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{shipments.length ? `${completed}/${shipments.length} selesai` : "Menunggu pengiriman"}</span>
        </header>
        {risks.some((risk) => !risk.pengirimanId) ? (
          <div className="space-y-2 border-b bg-muted/10 px-4 py-3">
            <div>
              <p className="text-xs font-semibold">Catatan kejadian lama · belum ditautkan ke kargo</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Catatan ini dibuat sebelum kejadian dikaitkan dengan kargo dan tahap pengiriman.</p>
            </div>
            {risks.filter((risk) => !risk.pengirimanId).map((risk) => (
              <div key={String(risk.id)} className="rounded-md border bg-background px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Dampak {plainText(risk.tingkat) || "belum dinilai"}</span>
                  <span className="text-muted-foreground">{deliveryDate(risk.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{plainText(risk.deskripsi)}</p>
                {risk.mitigasi ? <p className="mt-1 text-muted-foreground">Tindak lanjut: {plainText(risk.mitigasi)}</p> : null}
              </div>
            ))}
          </div>
        ) : null}
        <div className="space-y-2 bg-muted/10 p-3">
          {shipments.length ? shipments.map((shipment) => {
            const inspections = records(shipment.pemeriksaan);
            const hasInspection = inspections.length > 0;
            const hasReception = receptionDone(shipment);
            const hasUnloaded = unloadingDone(shipment);
            const hasReachedDestination = hasReachedDischarge(shipment);
            const hasHandover = handoverDone(shipment);
            const receipt = object(shipment.penerimaan);
            const receiptId = String(receipt.id ?? "");
            const storageRows = storage.filter((row) => String(row.penerimaanId ?? "") === receiptId);
            const shipmentRisks = risks.filter((risk) => String(risk.pengirimanId ?? "") === String(shipment.id));
            const unit = plainText(object(shipment.kontrak).satuanKontrak) || plainText(planning.satuan) || plainText(object(shipment.detail).satuan);
            const targetQuantity = Number(receipt.kuantitasDiterima);
            const expectedQuantity = Number.isFinite(targetQuantity) && targetQuantity > 0 ? plainText(receipt.kuantitasDiterima) : "";
            const delivered = deliveredQuantity(shipment);
            const handoverDocuments = records(shipment.serahTerima).filter((row) => typeof object(row.dokumen).id === "string");
            const progressText = expectedQuantity
              ? `${delivered} / ${expectedQuantity}${unit ? ` ${unit}` : ""} diserahkan`
              : `${records(shipment.serahTerima).length} catatan serah-terima`;
            const allDone = hasReachedDestination && hasInspection && hasReception && hasHandover;
            return <article key={String(shipment.id)} className="overflow-hidden rounded-lg border bg-background">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5"><div><h4 className="text-sm font-semibold">{plainText(shipment.namaKapal) || "Pengiriman"}</h4><p className="mt-0.5 text-xs text-muted-foreground">Rencana {formatQuantity(shipment.volumeRencana, unit)} · B/L {plainText(shipment.nomorBillOfLading) || "belum dicatat"} · {(plainText(shipment.status) || "direncanakan").replaceAll("_", " ")}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-medium ${allDone ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>{allDone ? "Selesai" : "Berjalan"}</span></div>
              <div className="divide-y">
                {checklistRow("1", "Pemeriksaan kuantitas dan mutu", hasInspection ? `${inspections.length} hasil tercatat. Tambah hasil untuk titik pemeriksaan lain atau pemeriksaan ulang.` : "Catat hasil di titik yang ditetapkan kontrak; pemeriksaan bisa dilakukan saat muat maupun setelah tiba.", hasInspection, action("pemeriksaan", hasInspection ? "Tambah hasil" : "Catat pemeriksaan", shipment))}
                {checklistRow("2", "Penerimaan penyedia / BAST", hasReception ? `BAST ${plainText(receipt.nomorBast) || "tercatat"} · ${formatQuantity(receipt.kuantitasDiterima, unit)}` : !hasUnloaded ? plainText(shipment.status) === "tiba" ? "Kargo sudah tiba. Selesaikan pembongkaran sebelum mencatat BAST." : "Menunggu kargo tiba dan dibongkar. Hasil pemeriksaan saat muat tetap dapat dicatat lebih dulu." : !hasInspection ? "Kargo sudah dibongkar. Catat hasil pemeriksaan sesuai kontrak sebelum membuat BAST." : "Kargo sudah dibongkar dan hasil pemeriksaan tersedia. Catat tanggal, titik serah, kuantitas, mutu, dan nomor BAST.", hasReception, !hasReception ? action("penerimaan", "Catat BAST", shipment, !hasInspection || !hasUnloaded) : undefined)}
                {checklistRow("•", "Penyimpanan", storageRows.length ? `${storageRows.length} catatan persediaan terkait BAST ini.` : "Opsional setelah BAST. Catat hanya jika kargo benar-benar disimpan atau dipindahkan sebelum diserahkan.", storageRows.length > 0, action("penyimpanan", storageRows.length ? "Tambah catatan" : "Catat penyimpanan", shipment, !hasReception || !hasUnloaded), true)}
                {checklistRow("3", "Serah-terima kepada Penerima Pasokan", hasHandover ? progressText : hasReception && !hasUnloaded ? "Tersedia setelah kargo berada pada tahap dibongkar." : hasReception ? `${progressText}. Isi penerima, tanggal, titik serah, dokumen, dan kuantitas; catat beberapa kali jika penyerahan bertahap.` : "Tersedia setelah kargo dibongkar dan BAST penerimaan tercatat.", hasHandover, !hasHandover ? action("serah-terima", "Catat serah-terima", shipment, !hasReception || !hasUnloaded) : undefined)}
              </div>
              {handoverDocuments.length ? (
                <div className="space-y-1.5 border-t bg-muted/10 px-3 py-2.5">
                  <p className="text-xs font-semibold">Bukti serah-terima</p>
                  {handoverDocuments.map((handover) => {
                    const document = object(handover.dokumen);
                    return (
                      <div key={String(document.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                        <span className="text-muted-foreground">{deliveryDate(handover.tanggalSerah)}{handover.nomorDokumen ? ` · ${plainText(handover.nomorDokumen)}` : ""}</span>
                        <ReadDocumentButton documentId={String(document.id)} name={plainText(document.nama) || "Buka bukti serah-terima"} />
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {shipmentRisks.length ? <div className="space-y-2 border-t bg-amber-50/50 px-3 py-2.5 dark:bg-amber-950/10"><p className="text-xs font-semibold">Kejadian tercatat · {shipmentRisks.length}</p>{shipmentRisks.map((risk) => <div key={String(risk.id)} className="rounded-md border bg-background px-2.5 py-2 text-xs"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">Tahap {shipmentStatusLabel(plainText(risk.tahapPengiriman))}</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Dampak {plainText(risk.tingkat) || "belum dinilai"}</span><span className="text-muted-foreground">{deliveryDate(risk.createdAt)}</span></div><p className="mt-1 whitespace-pre-wrap text-foreground">{plainText(risk.deskripsi)}</p>{risk.mitigasi ? <p className="mt-1 text-muted-foreground">Tindak lanjut: {plainText(risk.mitigasi)}</p> : null}</div>)}</div> : null}
            </article>;
          }) : <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Checklist per kargo muncul setelah pengiriman dicatat.</p>}
        </div>
      </section>

    </section>
  );
}

function ReconciliationSnapshotPanel({
  quantityRows,
  financialRows,
  readiness,
  totalsLoading,
  totalsError,
  status,
  shipmentCount,
  requiredDocumentCount,
  fulfilledDocumentCount,
}: {
  quantityRows: Entity[];
  financialRows: Entity[];
  readiness: ReturnType<typeof getReconciliationReadiness>;
  totalsLoading: boolean;
  totalsError?: string;
  status: string;
  shipmentCount: number;
  requiredDocumentCount: number;
  fulfilledDocumentCount: number;
}) {
  const quantity = (value: unknown, unit: unknown) =>
    value == null || value === "" ? "—" : `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(Number(value))}${unit ? ` ${plainText(unit)}` : ""}`;
  const money = (value: unknown, currency: unknown) => {
    if (value == null || value === "") return "Belum dapat dicocokkan";
    return `${plainText(currency) || "—"} ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(Number(value))}`;
  };
  const openClaimCount = readiness.openClaimCount;
  const blockers = [
    ...readiness.blockers,
    ...(totalsLoading ? ["Menunggu ringkasan rekonsiliasi selesai dihitung."] : []),
    ...(totalsError ? [`Ringkasan otomatis gagal dimuat: ${totalsError}`] : []),
  ];
  const canSave = readiness.ready && !totalsLoading && !totalsError;
  const checkpoints = [
    {
      label: "Penerimaan kargo",
      note: `${readiness.receivedCargoCount}/${shipmentCount} kargo memiliki kuantitas BAST`,
      complete: readiness.deliveryReady,
    },
    {
      label: "Tagihan dan pembayaran",
      note: `${readiness.activeInvoiceCount} tagihan relevan sudah terbit dan lunas`,
      complete: readiness.financialReady,
    },
    {
      label: "Klaim",
      note: openClaimCount ? `${openClaimCount} klaim perlu ditutup atau ditindaklanjuti` : "Tidak ada klaim terbuka",
      complete: readiness.claimsReady,
    },
  ];

  return (
    <section className="space-y-4 rounded-lg border bg-muted/10 p-4" aria-label="Pratinjau rekonsiliasi">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Ringkasan yang akan disimpan</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Sistem mengambil snapshot dari BAST, tagihan, pembayaran, dan klaim saat disimpan. Ini belum menutup Settlement.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${canSave ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          {canSave ? "Siap ditinjau" : "Pratinjau saja"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {checkpoints.map((checkpoint) => (
          <div key={checkpoint.label} className="rounded-md border bg-background px-3 py-2.5">
            <p className="flex items-center gap-2 text-xs font-semibold">
              <span className={`size-2 rounded-full ${checkpoint.complete ? "bg-emerald-600" : "bg-amber-500"}`} />
              {checkpoint.label}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{checkpoint.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="overflow-hidden rounded-md border bg-background">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-semibold">Volume per kargo</p>
          </div>
          <div className="max-h-40 overflow-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="sticky top-0 bg-muted/50 text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Kargo</th><th className="px-3 py-2 font-medium">Rencana</th><th className="px-3 py-2 font-medium">BAST</th><th className="px-3 py-2 font-medium">Selisih</th></tr>
              </thead>
              <tbody className="divide-y">
                {quantityRows.map((row) => (
                  <tr key={String(row.shipmentId)}>
                    <td className="px-3 py-2">{plainText(row.reference) || "Kargo"}</td>
                    <td className="px-3 py-2">{quantity(row.planned, row.unit)}</td>
                    <td className="px-3 py-2">{quantity(row.accepted, row.unit)}</td>
                    <td className="px-3 py-2 font-medium">{quantity(row.acceptedMinusPlanned, row.unit)}</td>
                  </tr>
                ))}
                {!quantityRows.length ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">{totalsLoading ? "Menghitung ringkasan…" : "Belum ada data volume."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border bg-background">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-semibold">Tagihan dan pembayaran per arah/mata uang</p>
          </div>
          <div className="max-h-40 overflow-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="sticky top-0 bg-muted/50 text-muted-foreground">
                <tr><th className="px-3 py-2 font-medium">Arah</th><th className="px-3 py-2 font-medium">Tagihan</th><th className="px-3 py-2 font-medium">Dibayar</th><th className="px-3 py-2 font-medium">Sisa</th></tr>
              </thead>
              <tbody className="divide-y">
                {financialRows.map((row) => (
                  <tr key={`${String(row.direction)}:${String(row.currency)}`}>
                    <td className="px-3 py-2">{row.direction === "masuk" ? "Penerima Pasokan" : row.direction === "keluar" ? "Penyedia" : "Belum dipetakan"}</td>
                    <td className="px-3 py-2">{money(row.invoice, row.currency)}</td>
                    <td className="px-3 py-2">{money(row.payment, row.currency)}</td>
                    <td className="px-3 py-2">{row.outstandingComparable === true ? money(row.outstanding, row.currency) : "Belum dapat dicocokkan"}</td>
                  </tr>
                ))}
                {!financialRows.length ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">{totalsLoading ? "Menghitung ringkasan…" : "Belum ada tagihan terbit untuk dicocokkan."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-background px-3 py-2.5 text-xs">
        <p className="font-semibold">Dokumen sebelum finalisasi</p>
        <p className="mt-1 text-muted-foreground">{fulfilledDocumentCount}/{requiredDocumentCount} dokumen wajib tercatat. Berita acara/dokumen rekonsiliasi dilengkapi sebelum finalisasi; menyimpan snapshot belum menutup Settlement.</p>
      </div>

      {!canSave ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-950">
          <p className="font-semibold">Snapshot belum bisa disimpan</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">{blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul>
        </div>
      ) : null}
      {status === "aktif" ? (
        <p className="rounded-md border bg-background px-3 py-2.5 text-xs text-muted-foreground">Memperbarui snapshot akan mengembalikan status peninjauan ke draft. Setelah menyimpan, mulai tinjau kembali sebelum finalisasi.</p>
      ) : null}
    </section>
  );
}

function ReconciliationStatusPanel({
  targetStatus,
  quantityCount,
  financialCount,
  requiredDocumentCount,
  fulfilledDocumentCount,
}: {
  targetStatus: string;
  quantityCount: number;
  financialCount: number;
  requiredDocumentCount: number;
  fulfilledDocumentCount: number;
}) {
  const finalizing = targetStatus === "selesai";
  const steps = [
    { title: "Snapshot disimpan", description: `${quantityCount} kargo · ${financialCount} ringkasan tagihan/mata uang`, state: "done" },
    { title: "Tinjau rekonsiliasi", description: "Periksa kecocokan volume, pembayaran, dan catatan keputusan.", state: finalizing ? "done" : "current" },
    { title: "Finalisasi", description: `${fulfilledDocumentCount}/${requiredDocumentCount} dokumen wajib tercatat`, state: finalizing ? "current" : "next" },
  ];

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" aria-label="Konfirmasi alur rekonsiliasi">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alur rekonsiliasi</p>
        <h3 className="mt-1 text-sm font-semibold">{finalizing ? "Finalisasi hasil peninjauan" : "Mulai peninjauan resmi"}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {finalizing
            ? "Aksi ini menandai rekonsiliasi sebagai final setelah hasil ditinjau dan dokumen wajib tersedia."
            : "Aksi ini mengubah status snapshot menjadi Sedang ditinjau. Angka BAST, tagihan, dan pembayaran tetap mengikuti snapshot yang sudah disimpan; aksi ini tidak mengubah transaksi."}
        </p>
      </div>

      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className={`min-w-0 rounded-md border px-3 py-3 ${step.state === "current" ? "border-primary/40 bg-primary/[0.04]" : "bg-muted/20"}`}>
            <p className="flex items-center gap-2 text-xs font-semibold">
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] ${step.state === "done" ? "bg-emerald-100 text-emerald-800" : step.state === "current" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {step.state === "done" ? <Check size={12} /> : index + 1}
              </span>
              {step.title}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>

      <div className={`rounded-md border px-3 py-2.5 text-xs leading-5 ${finalizing ? "border-amber-200 bg-amber-50/70 text-amber-950" : "bg-muted/20 text-muted-foreground"}`}>
        {finalizing
          ? "Setelah rekonsiliasi final, tandai tahap Settlement selesai secara terpisah jika seluruh prasyarat tahap sudah terpenuhi."
          : "Jika data sumber berubah selama peninjauan, snapshot akan kembali menjadi draft. Perbarui snapshot lalu mulai peninjauan kembali."}
      </div>
    </section>
  );
}

/** Standalone: parent supplies unwrapped GET siklus detail; mutations invalidate lifecycle and related lists. */
export function LifecycleOperations(props: LifecycleOperationsProps) {
  // Changing procurement/stage clears form state, without leaking previous IDs or success messages.
  return <OperationsPanel key={`${props.pengadaanId}:${props.stage}`} {...props} />;
}

function OperationsPanel({ pengadaanId, stage, active, detail: rawDetail }: LifecycleOperationsProps) {
  const detail = object(unwrap(rawDetail));
  const user = useCurrentUser();
  const currentUser = object(unwrap(user.data));
  const role = String(currentUser.role ?? "").toLowerCase();
  const isAssignedMember =
    role !== "member" || records(detail.tahapan).some((row) => String(row.tahap) === stage && records(row.assignments).some((assignment) => String(assignment.userId ?? object(assignment.user).id) === String(currentUser.id)));
  const id = useId();
  const [selected, setSelected] = useState<Operation | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [handoverEvidence, setHandoverEvidence] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [closingNegotiation, setClosingNegotiation] = useState<Entity | null>(null);
  const [closingReason, setClosingReason] = useState("");
  const [selectedNegotiationId, setSelectedNegotiationId] = useState("");
  const submitting = useRef(false);
  const revisionSeedKey = useRef("");
  const uninitialized = stage === "perencanaan" && Array.isArray(detail.tahapan) && detail.tahapan.length === 0;
  const isPublicDirectPurchase = String(detail.metode) === "pengadaan_langsung";
  const latestNegotiations: Entity[] = records(detail.penawaran).flatMap((offer) => {
    const latest = [...records(offer.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0];
    return latest ? [{ ...latest, penawaranId: offer.id, vendor: offer.vendor }] : [];
  });
  const passedVendorIds = new Set(
    records(object(detail.pemilihanPenyedia).peserta)
      .filter((participant) => participant.status === "lulus")
      .map((participant) => String(participant.vendorId ?? object(participant.vendor).id ?? "")),
  );
  const verificationRecords = records(detail.verifikasi);
  const verificationVendors = [...records(detail.penawaran)]
    .filter((offer) => offer.isCurrent !== false && !!offer.submittedAt)
    .sort((left, right) => Number(right.revisi ?? 0) - Number(left.revisi ?? 0))
    .reduce<Entity[]>((vendors, offer) => {
      const vendorId = String(offer.vendorId ?? object(offer.vendor).id ?? "");
      if (vendorId && !vendors.some((vendor) => vendor.id === vendorId)) {
        vendors.push({
          id: vendorId,
          nama: object(offer.vendor).nama ?? "Vendor",
          verifikasi: verificationRecords.find((row) => String(row.vendorId) === vendorId),
        });
      }
      return vendors;
    }, []);
  const verifiedVendors = verificationVendors.filter((vendor) => Boolean(vendor.verifikasi));
  const pendingVendors = verificationVendors.filter((vendor) => !vendor.verifikasi);
  const startableOffers = records(detail.penawaran).filter((offer) => {
    const latest = [...records(offer.negosi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0];
    return offer.isCurrent !== false && !!offer.submittedAt && passedVendorIds.has(String(offer.vendorId ?? object(offer.vendor).id ?? "")) && (!latest || latest.status === "ditolak");
  });
  const offersWithoutNegotiation = startableOffers.filter((offer) => records(offer.negosiasi).length === 0);
  const chosenNegotiation = latestNegotiations.find((row) => String(row.id) === selectedNegotiationId) ?? null;
  const chosenContinuation = chosenNegotiation?.status === "ditolak" ? chosenNegotiation : undefined;
  const available = lifecycleOperations.filter(
    (op) => op.stages.includes(stage) && op.roles.includes(role) && (op.key !== "verifikasi" || role !== "member" || isAssignedMember) && (!uninitialized || op.key === "perencanaan") && (!op.available || op.available(detail)),
  );
  const settlementHistory = use_query<Entity, Error, string>({
    tag: "lifecycleHistory",
    method: "transaksiControllerLifecycleHistory",
    params: pengadaanId,
    enabled: stage === "settlement",
    queryFn: async (procurementId) => {
      setBrowserToken();
      return object(unwrap(await apiData(browserApi.siklusTransaksiKomoditas.transaksiControllerLifecycleHistory(procurementId, { format: "json" }) as unknown as Promise<{ data: unknown }>)));
    },
  });
  const canManageRecommendation = active && stage === "rekomendasi_pemenang" && ["admin", "operator", "verifikator", "member"].includes(role) && (role !== "member" || isAssignedMember);
  const fields =
    selected?.fields
      .filter((field) => {
        if (role === "vendor" && field.name === "vendorId") return false;
        if (selected.key === "tutupRfq" || selected.key === "bukaKembaliRfq") return false;
        if (["status-tagihan", "status-pembayaran", "status-klaim"].includes(selected.key) && field.name === "entityId" && values.entityId) return false;
        if (["status-tagihan", "status-pembayaran", "status-rekonsiliasi"].includes(selected.key) && field.name === "status" && values.status) return false;
        if (selected.key === "pembayaran" && field.name === "tagihanId" && values.tagihanId) return false;
        if (selected.key === "pembayaran" && field.name === "mataUang" && values.tagihanId) return false;
        if (selected.key === "tagihan" && field.name === "arah" && values.arah) return false;
        if (selected.key === "tagihan" && field.name === "kontrakId" && values.__autoTagihanContractId) return false;
        if (selected.key === "tagihan" && values.arah === "keluar" && values.__autoTagihanContractId && ["pihak", "mataUang"].includes(field.name)) return false;
        if (selected.key === "rfq" && isPublicDirectPurchase) return !["mode", "vendorIds", "rfqId", "rfqIds", "alasanPerubahan"].includes(field.name);
        if (selected.key !== "rfq") return true;
        const mode = values.mode || "baru";
        if (mode === "baru") return field.name !== "rfqId" && field.name !== "alasanPerubahan";
        if (mode === "tambah_vendor") return ["mode", "rfqId", "vendorIds"].includes(field.name);
        return field.name !== "vendorIds";
      })
      .map((field) => (selected?.key === "rfq" && field.name === "rfqId" && values.mode === "revisi" ? { ...field, name: "rfqIds", label: "RFQ acuan (pilih satu atau beberapa)", multiple: true, required: true } : field)) ?? [];
  const statusShipmentForModal = selected?.key === "status-pengiriman"
    ? records(detail.pengiriman).find((row) => String(row.id) === String(values.entityId ?? ""))
    : undefined;
  const riskShipmentForModal = selected?.key === "risiko"
    ? records(detail.pengiriman).find((row) => String(row.id) === String(values.pengirimanId ?? ""))
    : undefined;
  const paymentInvoiceForModal = selected?.key === "pembayaran"
    ? records(detail.tagihan).find((row) => String(row.id) === String(values.tagihanId ?? ""))
    : undefined;
  const paidOnPaymentInvoice = records(paymentInvoiceForModal?.pembayaran).filter((row) => row.status === "selesai").reduce((sum, row) => sum + Number(row.nilai ?? 0), 0);
  const paymentInvoiceOutstanding = paymentInvoiceForModal ? Math.max(Number(paymentInvoiceForModal.nilai ?? 0) - paidOnPaymentInvoice, 0) : 0;
  const needsVendors = !!selected && fields.some((field) => field.relation === "vendor");
  const vendors = use_query<Entity[], Error, string>({
    tag: "vendor",
    method: "lifecycleOperationsVendors",
    params: "all",
    enabled: needsVendors && active,
    queryFn: async () => {
      setBrowserToken();
      const result = new Map<string, Entity>();
      for (let page = 1; ; page++) {
        const raw = await apiData(browserApi.vendor.vendorGetControllerFindAll({ page, limit: 100 }, { format: "json" }) as unknown as Promise<{ data: unknown }>);
        let envelope = object(raw);
        // Preserve pagination when legacy transport adds another data wrapper.
        if (!Array.isArray(envelope.data) && object(envelope.data).pagination) envelope = object(envelope.data);
        const rows = records(unwrap(envelope));
        for (const row of rows) if (typeof row.id === "string") result.set(row.id, row);
        const totalPages = Number(object(envelope.pagination).total_pages);
        if ((Number.isFinite(totalPages) && page >= totalPages) || rows.length < 100) break;
        if (page >= 1000) throw new Error("Daftar vendor terlalu besar. Hubungi admin untuk memeriksa paginasi.");
      }
      return [...result.values()];
    },
  });
  const options = (field: Field): Choice[] => {
    if (field.relation === "vendor") {
      const related = ["rfq", "penawaran", "verifikasi", "kontrak"].flatMap((key) => records(detail[key]).map((row) => object(row.vendor)));
      // Full directory remains source of status; detail-only rows fill gaps, never replace fetched rows.
      const all = new Map<string, Entity>();
      for (const row of [...related, ...(vendors.data ?? [])]) if (typeof row.id === "string") all.set(row.id, row);
      const winnerId = String(object(detail.pemilihanPenyedia).vendorTerpilihId ?? "");
      const winnerApproved = object(detail.pemilihanPenyedia).status === "disetujui";
      const biddingVendorIds = new Set(
        records(detail.penawaran)
          .filter((offer) => offer.isCurrent !== false && offer.submittedAt)
          .map((offer) => String(offer.vendorId)),
      );
      return choices(
        [...all.values()].filter(
          (row) =>
            (selected?.key !== "penawaran" || row.status === "aktif") &&
            (selected?.key !== "verifikasi" || biddingVendorIds.has(String(row.id))) &&
            (selected?.key !== "kontrak" || !winnerApproved || !winnerId || String(row.id) === winnerId),
        ),
      );
    }
    if (field.relation === "penawaran" && selected?.key === "negosiasi") {
      return startableOffers
        .map((offer) => {
          const vendorName = plainText(object(offer.vendor).nama) || "Vendor";
          const rfqNumber = plainText(offer.nomorRfq) || plainText(object(offer.rfq).nomor);
          const revision = offer.revisi == null ? "R1" : `R${String(offer.revisi)}`;
          const unit = plainText(object(object(offer.detail).rfqBaseline).satuan);
          const amount = offer.hargaPenawaran == null ? "" : `${plainText(offer.mataUang)} ${String(offer.hargaPenawaran)}${unit ? ` / ${unit}` : ""}`.trim();
          return {
            value: String(offer.id ?? ""),
            label: [vendorName, rfqNumber ? `RFQ ${rfqNumber}` : "Penawaran", revision, amount].filter(Boolean).join(" · "),
          };
        })
        .filter((choice) => choice.value);
    }
    if (field.relation === "rfqAktif" || field.relation === "rfqTertutup") {
      const rows = records(detail.rfq).filter((row) => row.status === (field.relation === "rfqAktif" ? "aktif" : "selesai"));
      const unique = new Map<string, Entity>();
      for (const row of rows) {
        const key = String(row.kelompokId ?? row.id ?? "");
        const current = unique.get(key);
        if (!current || Number(row.revisi ?? 1) > Number(current.revisi ?? 1)) unique.set(key, row);
      }
      return [...unique.values()].map((row) => ({
        value: String(row.id ?? ""),
        label: row.isPublic ? `${String(row.nomor ?? "RFQ")} · RFQ publik · R${String(row.revisi ?? 1)}` : `${String(row.nomor ?? "RFQ")} · ${String(object(row.vendor).nama ?? "vendor")} · R${String(row.revisi ?? 1)}`,
      }));
    }
    if (field.relation === "kontrak")
      return contractChoices(
        records(detail.kontrak).filter((contract) => contract.status === "efektif"),
        records(detail.pengiriman),
        selected?.key === "update-pengiriman" ? String(values.entityId ?? "") : undefined,
      );
    if (field.relation === "pengiriman") return shipmentChoices(records(detail.pengiriman));
    if (field.relation === "tagihan")
      return records(detail.tagihan).map((invoice) => ({
        value: String(invoice.id ?? ""),
        label: [plainText(invoice.nomor) || "Tagihan", plainText(invoice.pihak), plainText(invoice.arah).replaceAll("_", " "), invoice.mataUang ? `${plainText(invoice.mataUang)} ${plainText(invoice.nilai)}` : ""].filter(Boolean).join(" · "),
      })).filter((choice) => choice.value);
    if (field.relation === "penerimaan") {
      return records(detail.penerimaan).flatMap((receipt) => {
        if (typeof receipt.id !== "string") return [];
        const shipment = records(detail.pengiriman).find((row) => String(object(row.penerimaan).id ?? "") === String(receipt.id));
        const identity = plainText(shipment?.namaKapal) || plainText(shipment?.nomorBillOfLading) || "Kargo";
        const bast = plainText(receipt.nomorBast);
        return [{ value: String(receipt.id), label: [bast ? `BAST ${bast}` : "Penerimaan", identity].join(" · ") }];
      });
    }
    if (field.relation) return choices(field.relation === "laporanDraft" ? records(detail.laporan).filter((row) => row.status === "draft") : records(detail[field.relation]));
    if (field.kind === "boolean")
      return [
        { value: "true", label: "Ya" },
        { value: "false", label: "Tidak" },
      ];
    const activeModel = values.modelPelaksanaan || plainText(object(detail.perencanaan).modelPelaksanaan);
    const directImport = activeModel === "pelaksanaan_impor_langsung";
    const optionValues = field.name === "arah" && selected?.key === "tagihan" && directImport
      ? (field.options ?? []).filter((value) => value === "keluar")
      : field.name === "pihakImportir" && directImport
        ? ["lemigas"]
        : field.options ?? [];
    return optionValues.map((value) => ({
      value,
      label: selected?.key === "verifikasi" && ["selesai", "ditolak", "revisi"].includes(value) ? ({ selesai: "Sesuai", ditolak: "Tidak sesuai", revisi: "Perlu perbaikan" } as Record<string, string>)[value] : value.replaceAll("_", " "),
    }));
  };
  function updateTagihanCargoSelection(shipmentIds: string[], direction?: string) {
    setValues((old) => {
      const activeDirection = direction ?? old.arah ?? "";
      const source = invoiceSuggestion(shipmentIds, activeDirection, detail);
      const next: Record<string, string> = { ...old, arah: activeDirection, pengirimanIds: shipmentIds.join(",") };
      const wasManuallyChanged = (field: string, marker: string) =>
        Boolean(old[field]) && (!old[marker] || old[field] !== old[marker]);
      const manualAmount = wasManuallyChanged("nilai", "__autoTagihanAmount");
      const manualCurrency = wasManuallyChanged("mataUang", "__autoTagihanCurrency");
      const manualParty = wasManuallyChanged("pihak", "__autoTagihanParty");

      if (!shipmentIds.length || !source.contract || source.mixedContracts) {
        if (old.nilai === old.__autoTagihanAmount) next.nilai = "";
        if (old.mataUang === old.__autoTagihanCurrency) next.mataUang = "";
        if (old.pihak === old.__autoTagihanParty) next.pihak = "";
        if (old.kontrakId === old.__autoTagihanContractId) next.kontrakId = "";
        next.__autoTagihanAmount = "";
        next.__autoTagihanCurrency = "";
        next.__autoTagihanParty = "";
        next.__autoTagihanContractId = "";
        next.__autoTagihanInfo = source.mixedContracts
          ? "Satu tagihan hanya dapat mengacu pada kargo dari kontrak yang sama. Pisahkan tagihan untuk kontrak lain."
          : source.contractNotEffective
            ? "Tagihan hanya dapat dibuat dari kargo dengan kontrak Penyedia yang sudah efektif atau dipenuhi."
            : "";
        return next;
      }

      const amount = source.suggestedValue == null ? "" : String(source.suggestedValue);
      const currency = source.currency;
      const party = source.party;
      next.kontrakId = source.contractId;
      next.__autoTagihanContractId = source.contractId;
      if (source.suggestedValue != null && !manualAmount) next.nilai = amount;
      next.__autoTagihanAmount = source.suggestedValue == null ? "" : amount;
      if (currency && (activeDirection === "keluar" || !manualCurrency)) next.mataUang = currency;
      next.__autoTagihanCurrency = currency;
      if (party && (activeDirection === "keluar" || !manualParty)) next.pihak = party;
      next.__autoTagihanParty = party;
      const formattedAmount = source.suggestedValue == null
        ? "nilai perlu diisi dari invoice"
        : `${currency} ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(source.suggestedValue)}`;
      const priceType = source.priceType === "formula_harga" ? "formula harga" : source.priceType === "harga_tetap" ? "harga tetap" : source.priceType.replaceAll("_", " ");
      const base = `Sumber: kontrak ${source.contractNumber || "aktif"}${priceType ? ` (${priceType})` : ""}; ${source.volume.toLocaleString("id-ID", { maximumFractionDigits: 4 })} ${source.unit} dari ${source.shipmentCount} kargo (${source.volumeBasis}) · nilai awal ${formattedAmount}.`;
      next.__autoTagihanInfo = activeDirection === "masuk"
        ? `${base} Ini hanya dasar nilai kargo dari kontrak Penyedia. Cocokkan dengan komitmen Penerima Pasokan; masukkan biaya atau tarif hanya jika memang disepakati.`
        : `${base} Cocokkan dengan invoice Penyedia; nilai dapat disesuaikan jika invoice berbeda.`;
      if (source.priceType === "formula_harga") next.__autoTagihanInfo += " Harga kontrak memakai formula, jadi nilai ini hanya estimasi awal dan harus dicocokkan dengan perhitungan invoice.";
      if (manualAmount) next.__autoTagihanInfo += " Nilai telah disesuaikan manual; periksa kembali setelah mengubah kargo.";
      return next;
    });
  }
  const mutation = use_mutation<unknown, Error, { operation: Operation; body: Entity; file?: File }>({
    tag: "siklusTransaksiKomoditas",
    method: "lifecycleBusinessOperation",
    invalidateKeys: [
      apiQueryKeys.resource("siklusTransaksiKomoditas"),
      apiQueryKeys.resource("lifecycleHistory"),
      apiQueryKeys.resource("lifecycleEvidence"),
      apiQueryKeys.resource("dokumen"),
      apiQueryKeys.resource("pengadaan"),
      apiQueryKeys.resource("approval"),
      apiQueryKeys.resource("dashboard"),
    ],
    mutationFn: async ({ operation, body, file }) => {
      setBrowserToken();
      if (operation.key === "serah-terima") {
        if (!file) throw new Error("Unggah bukti dokumen serah-terima.");
        const form = new FormData();
        for (const [key, value] of Object.entries(body)) {
          if (value !== undefined && value !== null) form.append(key, String(value));
        }
        form.append("file", file);
        return apiData(
          browserApi.request({
            path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/serah-terima`,
            method: "POST",
            body: form,
            type: ContentType.FormData,
            format: "json",
            secure: true,
          }) as Promise<{ data: unknown }>,
        );
      }
      return apiData(operation.run(pengadaanId, body) as Promise<{ data: unknown }>);
    },
  });
  const closeMutation = use_mutation<unknown, Error, { id: string; alasan: string }>({
    tag: "siklusTransaksiKomoditas",
    method: "closeNegotiation",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("pengadaan"), apiQueryKeys.resource("dashboard")],
    mutationFn: async ({ id, alasan }) => {
      setBrowserToken();
      return apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/negosiasi/${encodeURIComponent(id)}/akhiri`,
          method: "POST",
          body: { alasan },
          type: ContentType.Json,
          format: "json",
          secure: true,
        }) as Promise<{ data: unknown }>,
      );
    },
  });
  const locked = mutation.isPending || closeMutation.isPending || submitting.current;
  const permitted = !!selected && active && available.some((op) => op.key === selected.key);
  const vendorBlocked = needsVendors && (vendors.isPending || vendors.isError);
  const missingRelation = fields.some((field) => field.required && field.relation && !options(field).length);
  const settlementTotals = object(settlementHistory.data?.totals ?? detail.totals);
  const reconciliationReadiness = getReconciliationReadiness(
    object(detail.perencanaan),
    records(detail.tagihan),
    records(detail.pengiriman),
    records(detail.klaim),
  );
  const reconciliationQuantityRows = records(settlementTotals.quantityDeltas);
  const reconciliationFinancialRows = records(settlementTotals.financial);
  const reconciliationStatus = plainText(object(detail.rekonsiliasi).status);
  const reconciliationSnapshotReady = reconciliationReadiness.ready && !settlementHistory.isPending && !settlementHistory.isError;
  const relevantSettlementDocuments = records(detail.persyaratanDokumen).filter(
    (row) => row.tahap === "settlement" &&
      !(object(detail.perencanaan).modelPelaksanaan !== "pengelolaan_manajemen_impor" && row.jenisDokumen === "invoice_penerima_pasokan") &&
      row.wajib === true,
  );
  useEffect(() => {
    if (selected?.key !== "rfq" || values.mode !== "revisi") {
      revisionSeedKey.current = "";
      return;
    }
    const ids = (values.rfqIds ?? "").split(",").filter(Boolean);
    const key = ids.join(",");
    if (!ids.length || key === revisionSeedKey.current) return;
    revisionSeedKey.current = key;
    const rfq = records(detail.rfq).find((row) => row.id === ids[0]);
    if (!rfq) return;
    const terms = object(rfq.ketentuan);
    const canonical = (key: string) => rfq[key] ?? normalizedTerm(terms, key);
    setValues((current) => ({
      ...current,
      nomor: String(rfq.nomor ?? "").replace(/-R\d+$/, ""),
      batasRespons: rfq.batasRespons ? String(rfq.batasRespons).slice(0, 10) : "",
      spesifikasi: parameterText(canonical("spesifikasi")),
      volume: plainText(canonical("volume")),
      satuan: plainText(canonical("satuan")),
      titikSerah: plainText(canonical("titikSerah")),
      syaratPenyerahan: plainText(canonical("syaratPenyerahan")),
      syaratPembayaran: plainText(canonical("syaratPembayaran")),
      dokumenDiminta: documentRequirementText(canonical("dokumenDiminta")),
    }));
  }, [detail.rfq, selected?.key, values.mode, values.rfqIds]);
  function open(operation: Operation, negotiation?: Entity, context?: Entity) {
    if (locked || !active) return;
    setHandoverEvidence(null);
    const continuation = negotiation ?? (operation.key === "negosiasi" ? chosenContinuation : undefined);
    const initial: Record<string, string> = operation.key === "rfq" ? { mode: "baru" } : {};
    if (operation.key === "negosiasi" && continuation) {
      initial.penawaranId = String(continuation.penawaranId ?? "");
      initial.batasNegosiasi = continuation.batasNegosiasi == null ? "" : String(continuation.batasNegosiasi);
      initial.hargaHasilNegosiasi = continuation.hargaHasilNegosiasi == null ? "" : String(continuation.hargaHasilNegosiasi);
      initial.hasil = continuation.hasil == null ? "" : String(continuation.hasil);
    }
    const seed = object(context ?? (operation.seed ? detail[operation.seed] : null));
    for (const field of operation.fields) {
      const value = seed[field.name];
      const seedValue = field.payloadPath ? field.payloadPath.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Entity)[key] : undefined), seed) : value;
      if (seedValue == null) continue;
      initial[field.name] =
        field.kind === "json" && typeof seedValue === "object" && seedValue !== null
          ? Object.entries(seedValue as Record<string, unknown>)
              .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
              .join("\n")
          : field.kind === "date"
            ? String(seedValue).slice(0, 10)
            : String(seedValue);
    }
    if (context?.id && operation.fields.some((field) => field.name === "entityId")) initial.entityId = String(context.id);
    if (context?.id && operation.fields.some((field) => field.name === "pengirimanId")) initial.pengirimanId = String(context.id);
    if (context?.id && operation.key === "pembayaran") initial.tagihanId = String(context.id);
    if (context?._targetStatus && operation.fields.some((field) => field.name === "status")) initial.status = String(context._targetStatus);
    if (context?.arah && operation.fields.some((field) => field.name === "arah")) initial.arah = String(context.arah);
    if (context && operation.key === "pembayaran" && context.mataUang) initial.mataUang = String(context.mataUang);
    if (context && operation.key === "pembayaran") {
      const paid = records(context.pembayaran).filter((row) => row.status === "selesai").reduce((sum, row) => sum + Number(row.nilai ?? 0), 0);
      const outstanding = Math.max(Number(context.nilai ?? 0) - paid, 0);
      if (outstanding > 0) initial.nilai = String(outstanding);
    }
    if (context?.arah && operation.key === "tagihan") {
      const party = String(object(detail.perencanaan).penerimaPasokan ?? "");
      if (context.arah === "masuk" && party) {
        initial.pihak = party;
        initial.__autoTagihanParty = party;
      }
    }
    if (operation.key === "status-pengiriman" && context) {
      const currentStatus = plainText(context.status) || "direncanakan";
      const needsStatusCorrection = currentStatus === "bermasalah" || (currentStatus === "diserahkan" && !shipmentHandoverComplete(context));
      initial.status = needsStatusCorrection ? "" : nextShipmentStatus(currentStatus) ?? currentStatus;
    }
    if (operation.key === "perencanaan" && (initial.modelPelaksanaan || object(detail.perencanaan).modelPelaksanaan) === "pelaksanaan_impor_langsung") initial.pihakImportir = "lemigas";
    if (context && operation.key === "penyimpanan") {
      const receipt = object(context.penerimaan);
      if (receipt.id) initial.penerimaanId = String(receipt.id);
      if (!initial.satuan && object(detail.perencanaan).satuan) initial.satuan = String(object(detail.perencanaan).satuan);
    }
    if (context && operation.key === "serah-terima") {
      const receipt = object(context.penerimaan);
      const planning = object(detail.perencanaan);
      initial.tanggalSerah = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
      initial.penerimaPasokan = String(planning.penerimaPasokan ?? "");
      initial.titikSerah = String(planning.titikSerah ?? receipt.titikSerah ?? "");
      initial.satuan = String(planning.satuan ?? object(context.detail).satuan ?? "");
      initial.kuantitasDiserahkan = receipt.kuantitasDiterima == null ? "" : String(receipt.kuantitasDiterima);
      initial.status = "diterima";
    }
    if (operation.key === "kontrak") {
      const selection = object(detail.pemilihanPenyedia);
      if (selection.status === "disetujui" && typeof selection.vendorTerpilihId === "string") initial.vendorId = selection.vendorTerpilihId;
    }
    revisionSeedKey.current = "";
    setValues(initial);
    setSelected(continuation ? { ...operation, title: "Buat Putaran Lanjutan" } : operation);
    setError("");
    setSuccess("");
    mutation.reset();
  }
  function close() {
    if (submitting.current || mutation.isPending) return;
    setSelected(null);
    setHandoverEvidence(null);
    setError("");
    mutation.reset();
  }
  async function submitClosing(event: React.FormEvent) {
    event.preventDefault();
    if (!closingNegotiation || locked || !closingReason.trim()) return;
    setError("");
    try {
      await closeMutation.mutateAsync({ id: String(closingNegotiation.id), alasan: closingReason.trim() });
      setSuccess("Negosiasi diakhiri tanpa kesepakatan.");
      setClosingNegotiation(null);
      setClosingReason("");
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current || mutation.isPending || !permitted || vendorBlocked || missingRelation || !selected) return;
    setError("");
    setSuccess("");
    try {
      if (selected.key === "rfq") {
        if (values.mode === "tambah_vendor" && !values.rfqId) throw new Error("Pilih RFQ acuan untuk tambah vendor.");
        if (values.mode === "revisi" && !(values.rfqIds ?? "").split(",").filter(Boolean).length) throw new Error("Pilih minimal satu RFQ acuan untuk direvisi.");
        if (values.mode === "revisi" && !values.alasanPerubahan?.trim()) throw new Error("Alasan revisi wajib diisi.");
      }
      if (selected.key === "tagihan") {
        const selectedIds = (values.pengirimanIds ?? "").split(",").filter(Boolean);
        const source = invoiceSuggestion(selectedIds, values.arah ?? "", detail);
        if (!selectedIds.length) throw new Error("Pilih minimal satu kargo untuk mengaitkan dasar tagihan.");
        if (!source.contract || source.mixedContracts) throw new Error("Pilih kargo dari satu kontrak Penyedia yang sudah efektif.");
        if (String(values.kontrakId ?? "") !== source.contractId) throw new Error("Kontrak tagihan harus mengikuti kontrak pada kargo yang dipilih.");
      }
      if (selected.key === "perencanaan" && values.modelPelaksanaan === "pengelolaan_manajemen_impor" && values.pihakImportir === "pihak_lain" && !values.namaImportir?.trim())
        throw new Error("Nama importir wajib diisi jika pihak lain dipilih.");
      if (selected.key === "perencanaan" && values.pihakImportir === "penerima_pasokan" && !values.penerimaPasokan?.trim())
        throw new Error("Nama Penerima Pasokan wajib diisi jika menjadi importir.");
      if (selected.key === "penerimaan") {
        const shipment = records(detail.pengiriman).find((row) => String(row.id) === String(values.pengirimanId ?? ""));
        if (shipment && Number(values.kuantitasDiterima) !== Number(shipment.volumeRencana) && (values.denganCatatan !== "true" || !values.catatan?.trim()))
          throw new Error("Kuantitas BAST berbeda dari alokasi rencana. Tandai penerimaan dengan catatan dan jelaskan selisihnya.");
      }
      if (selected.key === "pemeriksaan") {
        const shipment = records(detail.pengiriman).find((row) => String(row.id) === String(values.pengirimanId ?? ""));
        if (shipment && values.hasilKuantitas && quantityDiffers(values.hasilKuantitas, shipment.volumeRencana) && (values.diterimaDenganCatatan !== "true" || !values.catatan?.trim()))
          throw new Error("Hasil ukur berbeda dari alokasi rencana. Tandai hasil dengan catatan dan jelaskan selisihnya.");
      }
      if (selected.key === "serah-terima" && !handoverEvidence)
        throw new Error("Unggah bukti dokumen serah-terima sebelum menyimpan.");
      if (selected.key === "status-pengiriman" && values.status === "diserahkan") {
        const shipment = records(detail.pengiriman).find((row) => String(row.id) === String(values.entityId ?? ""));
        if (!shipmentHandoverComplete(shipment)) throw new Error("Catat serah-terima sampai total kuantitasnya sama dengan BAST sebelum menandai kargo diserahkan.");
      }
      if (["pengiriman", "update-pengiriman"].includes(selected.key)) {
        const contract = records(detail.kontrak).find((row) => String(row.id) === String(values.kontrakId ?? ""));
        const excludeId = selected.key === "update-pengiriman" ? String(values.entityId ?? "") : undefined;
        const remaining = contract ? remainingContractVolume(contract, records(detail.pengiriman), excludeId) : null;
        const proposed = Number(values.volumeRencana);
        const currentShipment = selected.key === "update-pengiriman" ? records(detail.pengiriman).find((row) => String(row.id) === excludeId) : undefined;
        const allocationChanged = !currentShipment ||
          String(currentShipment.kontrakId ?? "") !== String(values.kontrakId ?? "") ||
          quantityUnits(currentShipment.volumeRencana) !== quantityUnits(proposed);
        if (allocationChanged) {
          if (!contract || remaining == null) throw new Error("Kontrak belum memiliki volume total yang dapat dialokasikan.");
          if (!Number.isFinite(proposed) || proposed <= 0) throw new Error("Alokasi volume kargo harus lebih dari 0.");
          if (quantityUnits(proposed) > quantityUnits(remaining))
            throw new Error(`Alokasi melebihi sisa volume kontrak sebesar ${formatQuantity(proposed - remaining, contract.satuanKontrak)}.`);
        }
      }
      const statusOperation = ["status-tagihan", "status-pembayaran", "status-klaim", "status-rekonsiliasi"].includes(selected.key);
      const issuedInvoiceStatuses = ["diterbitkan", "dibayar_sebagian", "lunas"];
      const payloadFields = statusOperation
        ? selected.fields.filter((field) =>
            !(selected.key === "status-tagihan" && field.name === "diterbitkanPada" && !issuedInvoiceStatuses.includes(values.status ?? "")) &&
            !(selected.key === "status-pembayaran" && field.name === "dibayarPada" && values.status !== "selesai"),
          )
        : fields;
      const payloadValues = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, payloadFields.find((field) => field.name === name)?.kind === "json" ? cleanParameterRows(value) : value]));
      const body = operationPayload(payloadFields, payloadValues, options);
      // Contextual fields stay out of the form when the checklist already identifies the record.
      // Keep them in the API payload so updates still target the right record and direction.
      for (const name of ["entityId", "tagihanId", "arah", "mataUang", "status", "kontrakId", "pihak"]) {
        if (values[name] && body[name] == null) body[name] = values[name];
      }
      submitting.current = true;
      await mutation.mutateAsync({ operation: selected, body, file: selected.key === "serah-terima" ? handoverEvidence ?? undefined : undefined });
      setSuccess(
        selected.key === "rfq"
          ? isPublicDirectPurchase
            ? "RFQ publik berhasil diterbitkan. Vendor yang telah disetujui dapat mengirim penawaran hingga batas respons."
            : `RFQ berhasil diterbitkan kepada ${(body.vendorIds as string[] | undefined)?.length ?? 1} vendor.`
          : `${selected.title}: berhasil.`,
      );
      setSelected(null);
      setHandoverEvidence(null);
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      submitting.current = false;
    }
  }
  const operationPresentation: Record<string, { description: string; icon: typeof ClipboardList }> = {
    perencanaan: { description: "Catat kebutuhan transaksi dan jadwal pengadaan.", icon: ClipboardList },
    strategi: { description: "Tentukan metode seleksi dan pendekatan transaksi.", icon: Settings2 },
    rfq: { description: isPublicDirectPurchase ? "Terbitkan RFQ publik untuk vendor yang telah disetujui." : "Kirim atau perbarui permintaan penawaran kepada vendor.", icon: Send },
    tutupRfq: { description: "Akhiri penerimaan penawaran untuk RFQ aktif.", icon: FileCheck2 },
    bukaKembaliRfq: { description: "Aktifkan kembali RFQ yang telah ditutup.", icon: FileText },
    verifikasi: { description: "Periksa legalitas, kepatuhan, dan rekening vendor.", icon: FileCheck2 },
    negosiasi: { description: "Pilih penawaran lulus evaluasi. Sistem menentukan nomor putaran dan memakai biaya perolehan hasil evaluasi.", icon: Handshake },
    memorandum: { description: "Susun rekomendasi transaksi untuk persetujuan.", icon: FileText },
    kontrak: { description: "Catat kesepakatan dan dokumen kontrak.", icon: FileCheck2 },
    pengiriman: { description: "Pantau pengapalan dan status pengiriman kargo.", icon: Ship },
    tagihan: { description: "Kelola tagihan, pembayaran, dan rekonsiliasi.", icon: Wallet },
  };
  return (
    <section className="space-y-4" aria-label="Operasi bisnis tahap">
      {canManageRecommendation ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
          <p className="text-sm text-muted-foreground">Pilih peserta lulus sebagai pemenang rekomendasi sebelum memorandum.</p>
          <Button size="sm" onClick={() => window.dispatchEvent(new Event("lifecycle:open-recommendation"))}>
            Kelola rekomendasi
          </Button>
        </div>
      ) : null}
      {user.isError ? (
        <Alert variant="destructive">
          <AlertDescription>{getApiErrorMessage(user.error)}</AlertDescription>
        </Alert>
      ) : null}
      {!active ? <p className="text-sm text-muted-foreground">Operasi dinonaktifkan: tahap ini tidak aktif.</p> : null}
      {active && !user.isPending && !user.isError && !available.length && !canManageRecommendation ? (
        <p className="rounded-lg border border-dashed bg-background px-4 py-5 text-center text-sm text-muted-foreground">Belum ada operasi yang tersedia untuk peran atau status saat ini.</p>
      ) : null}
      {stage === "delivery" ? (
        <DeliveryChecklist
          active={active}
          locked={locked}
          operations={available.filter((operation) => ["pengiriman", "update-pengiriman", "status-pengiriman", "pemeriksaan", "penerimaan", "penyimpanan", "serah-terima", "risiko"].includes(operation.key))}
          contracts={records(detail.kontrak)}
          shipments={records(detail.pengiriman)}
          storage={records(detail.penyimpanan)}
          risks={records(detail.risiko)}
          planning={object(detail.perencanaan)}
          onOpen={(operation, context) => open(operation, undefined, context)}
        />
      ) : stage === "settlement" ? (
        <SettlementChecklist
          active={active}
          locked={locked}
          operations={available.filter((operation) => ["tagihan", "pembayaran", "status-tagihan", "status-pembayaran", "rekonsiliasi", "status-rekonsiliasi", "klaim", "status-klaim"].includes(operation.key))}
          planning={object(detail.perencanaan)}
          invoices={records(detail.tagihan)}
          shipments={records(detail.pengiriman)}
          payments={records(detail.pembayaran)}
          claims={records(detail.klaim)}
          reconciliation={detail.rekonsiliasi ? object(detail.rekonsiliasi) : undefined}
          totals={object(settlementHistory.data?.totals ?? detail.totals)}
          totalsLoading={settlementHistory.isPending}
          totalsError={settlementHistory.isError ? getApiErrorMessage(settlementHistory.error) : undefined}
          documentRequirements={records(detail.persyaratanDokumen).filter((row) => row.tahap === "settlement" && !(object(detail.perencanaan).modelPelaksanaan !== "pengelolaan_manajemen_impor" && row.jenisDokumen === "invoice_penerima_pasokan"))}
          readiness={active && detail.readiness ? object(detail.readiness) : undefined}
          onOpen={(operation, context) => open(operation, undefined, context)}
        />
      ) : (
      <div className="space-y-4">
        {available
          // Keep manual offer-entry operation configured for future use, but hide it from current workflow.
          .filter((operation) => !["tutupRfq", "bukaKembaliRfq", "penawaran"].includes(operation.key))
          .map((operation) => {
            if (operation.key === "negosiasi") {
              const activeNegotiations = latestNegotiations;
              const selectedNegotiation = chosenNegotiation ?? activeNegotiations[0] ?? null;
              const selectedOffer = records(detail.penawaran).find((offer) => String(offer.id) === String(selectedNegotiation?.penawaranId));
              const selectedLatest = selectedOffer ? [...records(selectedOffer.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0] : null;
              const canContinue = selectedNegotiation?.status === "ditolak";
              const presentation = operationPresentation.negosiasi;
              const Icon = presentation.icon;
              return (
                <div key={operation.key} className="space-y-3">
                  {startableOffers.length ? (
                    <div className="flex justify-end">
                      <Button type="button" disabled={!active || locked} onClick={() => open(operation)}>
                        <Handshake size={16} /> Catat negosiasi
                      </Button>
                    </div>
                  ) : null}
                  <section className="overflow-hidden rounded-xl border bg-background">
                    <header className="flex items-start gap-3 border-b bg-muted/20 p-4">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">Kelola negosiasi</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Semua vendor dan status negosiasi terbaru tercantum di sini. Mulai negosiasi baru untuk vendor eligible lain tanpa menghapus riwayat ini.</p>
                      </div>
                    </header>
                    {activeNegotiations.length ? (
                      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                        <div className="max-h-72 space-y-2 overflow-y-auto p-3" role="listbox" aria-label="Pilih negosiasi">
                          {activeNegotiations.map((negotiation) => {
                            const isSelected = String(selectedNegotiation?.id) === String(negotiation.id);
                            const offer = records(detail.penawaran).find((row) => String(row.id) === String(negotiation.penawaranId));
                            const statusLabels: Record<string, string> = {
                              menunggu_tanggapan: "Menunggu tanggapan",
                              ditolak: "Ditolak vendor",
                              disepakati: "Disepakati",
                            };
                            const statusLabel = statusLabels[String(negotiation.status)] ?? String(negotiation.status ?? "Status tidak diketahui");
                            const statusStyle =
                              negotiation.status === "ditolak"
                                ? "bg-destructive/10 text-destructive"
                                : negotiation.status === "disepakati"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
                            return (
                              <button
                                key={String(negotiation.id)}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                disabled={!active || locked}
                                onClick={() => setSelectedNegotiationId(String(negotiation.id))}
                                className={`w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${isSelected ? "border-primary bg-primary/[0.04] shadow-sm" : "hover:border-primary/30 hover:bg-muted/30"}`}
                              >
                                <span className="flex items-start justify-between gap-2">
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">{plainText(object(offer?.vendor).nama) || "Vendor"}</span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      RFQ {plainText(offer?.nomorRfq) || "—"} · Putaran {String(negotiation.putaran)}
                                    </span>
                                  </span>
                                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${statusStyle}`}>{statusLabel}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-col justify-between gap-4 border-t bg-muted/10 p-4 md:border-l md:border-t-0">
                          {selectedNegotiation ? (
                            <>
                              <div>
                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pilihan saat ini</p>
                                <h4 className="mt-1 font-semibold">{plainText(object(selectedOffer?.vendor).nama) || "Vendor"}</h4>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Putaran {String(selectedNegotiation.putaran)} · {selectedNegotiation.status === "ditolak" ? "Vendor menolak usulan" : "Menunggu tanggapan vendor"}
                                </p>
                                {selectedLatest?.hargaHasilNegosiasi != null ? (
                                  <p className="mt-2 text-sm">
                                    Harga terakhir:{" "}
                                    <strong>
                                      {plainText(object(selectedOffer).mataUang)} {String(selectedLatest.hargaHasilNegosiasi)}
                                    </strong>
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                  {canContinue
                                    ? "Vendor menolak usulan. Buat putaran lanjutan, atau mulai negosiasi dengan vendor lain."
                                    : selectedNegotiation.status === "disepakati"
                                      ? "Negosiasi dengan vendor ini berhasil disepakati."
                                      : "Putaran ini masih menunggu jawaban vendor. Anda tetap dapat memulai negosiasi dengan vendor lain."}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {canContinue ? (
                                  <Button type="button" disabled={!active || locked} onClick={() => open(operation, selectedNegotiation)}>
                                    <Handshake size={16} /> Buat putaran lanjutan
                                  </Button>
                                ) : null}
                                {selectedNegotiation.status !== "disepakati" ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-destructive/30 text-destructive hover:bg-destructive/5"
                                    disabled={!active || locked}
                                    onClick={() => {
                                      setClosingNegotiation(selectedNegotiation);
                                      setClosingReason("");
                                      setError("");
                                    }}
                                  >
                                    <Ban size={16} /> Akhiri tanpa kesepakatan
                                  </Button>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4">
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada riwayat negosiasi. Mulai negosiasi dengan vendor yang lulus evaluasi.</div>
                      </div>
                    )}
                  </section>
                </div>
              );
            }
            const presentation = operationPresentation[operation.key];
            const Icon = presentation?.icon ?? ClipboardList;
            return (
              <button
                key={operation.key}
                type="button"
                disabled={!active || locked}
                onClick={() => open(operation)}
                className="group flex min-h-[88px] w-full items-center gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{operation.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{presentation?.description ?? "Perbarui informasi transaksi pada tahap ini."}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </button>
            );
          })}
      </div>
      )}
      {success ? (
        <Alert role="status">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}
      <Modal
        open={!!closingNegotiation}
        onClose={() => !locked && setClosingNegotiation(null)}
        title="Akhiri Negosiasi Tanpa Kesepakatan"
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" disabled={locked} onClick={() => setClosingNegotiation(null)}>
              Batal
            </Button>
            <Button type="submit" variant="destructive" form={`${id}-close-negotiation`} disabled={locked || !closingReason.trim()}>
              {closeMutation.isPending ? "Mengakhiri…" : "Akhiri negosiasi"}
            </Button>
          </>
        }
      >
        <form id={`${id}-close-negotiation`} onSubmit={submitClosing} className="space-y-3">
          <p className="text-sm text-muted-foreground">Tindakan menutup putaran terbaru. Vendor tidak dapat memberi tanggapan atau menerima putaran lanjutan.</p>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-closing-reason`}>Alasan penutupan *</Label>
            <textarea id={`${id}-closing-reason`} value={closingReason} onChange={(event) => setClosingReason(event.target.value)} maxLength={4000} rows={4} required className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
          </div>
        </form>
      </Modal>
      <Modal
        open={!!selected}
        onClose={close}
        title={selected?.title ?? "Operasi transaksi"}
        size={selected?.key === "rekonsiliasi" ? "xl" : selected?.key === "status-rekonsiliasi" ? "lg" : "md"}
        footer={
          <>
            <Button type="button" variant="outline" disabled={locked} onClick={close}>
              Batal
            </Button>
            <Button type="submit" form={`${id}-form`} disabled={locked || !permitted || vendorBlocked || missingRelation || (selected?.key === "rekonsiliasi" && (!reconciliationSnapshotReady || reconciliationStatus === "selesai")) || (selected?.key === "serah-terima" && !handoverEvidence) || (selected?.key === "status-pengiriman" && (statusShipmentForModal?.status === "diserahkan" && shipmentHandoverComplete(statusShipmentForModal) || !values.status || (values.status === "diserahkan" && !shipmentHandoverComplete(statusShipmentForModal))))}>
              {locked
                ? "Menyimpan…"
                : selected?.key === "status-pengiriman"
                  ? statusShipmentForModal?.status === "diserahkan" && shipmentHandoverComplete(statusShipmentForModal)
                    ? "Progres selesai"
                    : values.status === "bermasalah"
                    ? "Tandai bermasalah"
                    : statusShipmentForModal?.status === "bermasalah" || (statusShipmentForModal?.status === "diserahkan" && !shipmentHandoverComplete(statusShipmentForModal))
                      ? `Pulihkan ke ${shipmentStatusLabel(values.status ?? "")}`
                      : `Lanjut ke ${shipmentStatusLabel(values.status ?? "")}`
                  : selected?.key === "rekonsiliasi"
                    ? "Simpan snapshot"
                    : selected?.key === "status-rekonsiliasi"
                      ? values.status === "selesai" ? "Finalisasi rekonsiliasi" : "Mulai peninjauan"
                    : "Simpan"}
            </Button>
          </>
        }
      >
        <form id={`${id}-form`} onSubmit={submit} className="space-y-4 px-1" aria-busy={locked}>
          {error ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!permitted && selected ? (
            <Alert variant="destructive">
              <AlertDescription>Peran, status, atau tahap berubah. Operasi tidak tersedia.</AlertDescription>
            </Alert>
          ) : null}
          {vendorBlocked ? (
            <Alert variant={vendors.isError ? "destructive" : "default"}>
              <AlertDescription>
                {vendors.isError ? getApiErrorMessage(vendors.error) : "Memuat seluruh vendor…"}
                {vendors.isError ? (
                  <Button type="button" variant="link" onClick={() => void vendors.refetch()}>
                    Coba lagi
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {missingRelation && !vendorBlocked ? (
            <Alert>
              <AlertDescription>Relasi wajib belum tersedia. Buat catatan terkait terlebih dahulu.</AlertDescription>
            </Alert>
          ) : null}
          {selected?.key === "rekonsiliasi" ? (
            <ReconciliationSnapshotPanel
              quantityRows={reconciliationQuantityRows}
              financialRows={reconciliationFinancialRows}
              readiness={reconciliationReadiness}
              totalsLoading={settlementHistory.isPending}
              totalsError={settlementHistory.isError ? getApiErrorMessage(settlementHistory.error) : undefined}
              status={reconciliationStatus}
              shipmentCount={records(detail.pengiriman).length}
              requiredDocumentCount={relevantSettlementDocuments.length}
              fulfilledDocumentCount={relevantSettlementDocuments.filter((row) => row.terpenuhi === true).length}
            />
          ) : null}
          {!fields.length && selected?.key === "submit-memorandum" ? (
            <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4" aria-label="Ringkasan pengajuan memorandum">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Siap diajukan</p>
                <h3 className="mt-1 text-base font-semibold">Konfirmasi pengajuan memorandum</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Memorandum yang tersimpan akan dikirim ke alur review. Setelah diajukan, isinya terkunci sampai reviewer meminta revisi.</p>
              </div>
              <dl className="grid gap-3 rounded-lg border bg-background p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Status memorandum</dt>
                  <dd className="mt-1 font-medium">{plainText(object(detail.memorandum).status).replaceAll("_", " ") || "Draft"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Vendor rekomendasi</dt>
                  <dd className="mt-1 font-medium">{plainText(object(object(detail.pemilihanPenyedia).vendorTerpilih).nama) || "Belum ditetapkan"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Metode seleksi</dt>
                  <dd className="mt-1 font-medium">{procurementMethodLabel(plainText(object(detail.strategi).metodeSeleksi) || plainText(detail.metode))}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status rekomendasi</dt>
                  <dd className="mt-1 font-medium">{plainText(object(detail.pemilihanPenyedia).status).replaceAll("_", " ") || "Belum direkomendasikan"}</dd>
                </div>
              </dl>
              <p className="text-xs leading-5 text-muted-foreground">Pengajuan membuat tiga tahap approval: Review Memorandum, Verifikasi Memorandum, lalu Persetujuan Pimpinan.</p>
            </section>
          ) : null}
          {!fields.length && !["submit-memorandum", "status-rekonsiliasi"].includes(selected?.key ?? "") ? <p>Konfirmasi {selected?.title.toLowerCase()} untuk pengadaan ini.</p> : null}
          {selected?.key === "memorandum"
            ? (() => {
                const strategy = object(detail.strategi);
                const selection = object(detail.pemilihanPenyedia);
                const winnerId = String(selection.vendorTerpilihId ?? "");
                const participant = records(selection.peserta).find((row) => String(row.vendorId) === winnerId);
                const offer = records(detail.penawaran).find((row) => String(row.id) === String(participant?.penawaranId ?? ""));
                const negotiation = [...records(offer?.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran))[0];
                const assignments = records(detail.tahapan).find((row) => row.tahap === "rekomendasi_pemenang");
                const votes = records(selection.votes);
                const amount = (value: unknown, currency = "") => {
                  if (value == null || value === "") return "—";
                  const number = Number(value);
                  return [currency, Number.isFinite(number) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(number) : String(value)].filter(Boolean).join(" ");
                };
                return (
                  <section className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4" aria-label="Bukti rekomendasi sistem">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Keputusan hulu · hanya baca</p>
                      <h3 className="mt-1 font-semibold">{plainText(object(selection.vendorTerpilih).nama) || "Vendor rekomendasi belum tersedia"}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Metode dan vendor ditetapkan dari strategi serta rekomendasi kolektif. Form tidak dapat menggantinya.</p>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Metode seleksi</dt>
                        <dd className="font-medium">{procurementMethodLabel(plainText(strategy.metodeSeleksi) || plainText(detail.metode))}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Status rekomendasi</dt>
                        <dd className="font-medium">{plainText(selection.status).replaceAll("_", " ") || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Peringkat / skor</dt>
                        <dd className="font-medium">{participant ? `${plainText(participant.peringkat) || "—"} / ${plainText(participant.skor) || "—"}` : "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Kuorum suara</dt>
                        <dd className="font-medium">
                          {votes.length} / {records(assignments?.assignments).length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Harga penawaran</dt>
                        <dd className="font-medium">{amount(offer?.hargaPenawaran, plainText(offer?.mataUang))}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Harga negosiasi</dt>
                        <dd className="font-medium">{amount(negotiation?.hargaHasilNegosiasi, plainText(offer?.mataUang))}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground">Hasil negosiasi</dt>
                        <dd className="font-medium">{plainText(negotiation?.hasil) || "—"}</dd>
                      </div>
                    </dl>
                    {votes.length ? (
                      <div>
                        <h4 className="text-sm font-semibold">Alasan anggota</h4>
                        <ul className="mt-2 space-y-2">
                          {votes.map((vote) => (
                            <li key={String(vote.id)} className="rounded-md border bg-background p-3 text-sm">
                              <span className="font-medium">{plainText(object(object(vote.assignment).user).nama) || "Anggota"}</span>
                              <p className="mt-1 text-muted-foreground">{plainText(vote.alasan) || "—"}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>
                );
              })()
            : null}
          {selected?.key === "verifikasi"
            ? (() => {
                const vendor = values.vendorId ? (vendors.data ?? []).find((row) => row.id === values.vendorId) : undefined;
                const documents = records(vendor?.vendorDocuments).filter((doc) => doc.status !== "replaced");
                const downloadDocument = async (documentId: string, filename: string) => {
                  try {
                    setDocumentError("");
                    const cookie = document.cookie
                      .split(";")
                      .map((part) => part.trim())
                      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
                      ?.slice(SESSION_COOKIE.length + 1);
                    const authToken = readSession(cookie)?.token;
                    if (!authToken) throw new Error("Sesi login tidak valid. Silakan login kembali.");
                    const response = await fetch(`${process.env.NEXT_PUBLIC_LEMIGAS_API_URL ?? "http://localhost:3001"}/api/vendor-onboarding/documents/${documentId}/file`, { headers: { Authorization: `Bearer ${authToken}` } });
                    if (!response.ok) throw new Error("Dokumen tidak dapat diunduh.");
                    const blobUrl = URL.createObjectURL(await response.blob());
                    const win = window.open(blobUrl, "_blank");
                    if (!win) throw new Error("Popup blocker mencegah pembukaan tab baru.");
                  } catch (cause) {
                    setDocumentError(cause instanceof Error ? cause.message : "Dokumen gagal dibuka.");
                  }
                };
                return (
                  <div className="space-y-3">
                    <section className="space-y-3 rounded-lg border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-semibold">Daftar verifikasi vendor</h3>
                          <p className="mt-1 text-xs text-muted-foreground">Vendor yang sudah mengirim penawaran pada pengadaan ini.</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{verifiedVendors.length} sudah | {pendingVendors.length} belum</p>
                      </div>
                      {verificationVendors.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            { title: "Belum diverifikasi", rows: pendingVendors, badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
                            { title: "Sudah diverifikasi", rows: verifiedVendors, badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
                          ].map((group) => (
                            <div key={group.title} className="min-w-0 rounded-md border bg-background p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <h4 className="text-xs font-semibold">{group.title}</h4>
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${group.badge}`}>{group.rows.length}</span>
                              </div>
                              {group.rows.length ? (
                                <ul className="max-h-36 space-y-1 overflow-y-auto">
                                  {group.rows.map((row) => {
                                    const result = plainText(object(row.verifikasi).hasil);
                                    const resultLabel = ({ selesai: "Sesuai", revisi: "Perlu perbaikan", ditolak: "Tidak sesuai" } as Record<string, string>)[result] ?? result.replaceAll("_", " ");
                                    const selectedVendor = values.vendorId === row.id;
                                    return (
                                      <li key={String(row.id)}>
                                        <button
                                          type="button"
                                          disabled={locked || !permitted}
                                          aria-pressed={selectedVendor}
                                          onClick={() => setValues((old) => ({ ...old, vendorId: String(row.id) }))}
                                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50 ${selectedVendor ? "bg-primary/10 text-primary" : ""}`}
                                        >
                                          <span className="min-w-0 truncate font-medium">{plainText(row.nama) || "Vendor"}</span>
                                          {resultLabel ? <span className="shrink-0 text-[11px] text-muted-foreground">{resultLabel}</span> : null}
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="py-2 text-xs text-muted-foreground">Tidak ada vendor.</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Belum ada vendor yang mengirimkan penawaran.</p>
                      )}
                    </section>
                    <section className="space-y-2 rounded-lg border bg-card p-4">
                    <div>
                      <h3 className="text-sm font-semibold">Dokumen onboarding vendor</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{vendor ? `Dokumen ${plainText(vendor.nama) || "vendor terpilih"}` : "Pilih vendor dari daftar atau kolom vendor untuk memeriksa dokumen onboarding."}</p>
                    </div>
                    {!values.vendorId ? (
                      null
                    ) : documents.length ? (
                      <div className="space-y-2">
                        <ul className="space-y-2">
                          {documents.map((doc) => (
                            <li key={String(doc.id)} className="flex items-center justify-between gap-3 text-sm">
                              <span className="flex items-center gap-2">
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${doc.status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                                  aria-label={doc.status === "verified" ? "Terverifikasi" : "Menunggu verifikasi"}
                                >
                                  <Check size={13} strokeWidth={2.5} />
                                </span>
                                <span>
                                  {String(doc.jenis)} · {doc.status === "verified" ? "Terverifikasi" : "Menunggu verifikasi"}
                                </span>
                              </span>
                              <Button type="button" variant="outline" size="sm" onClick={() => void downloadDocument(String(doc.id), `${String(doc.jenis)}.pdf`)}>
                                <ExternalLink size={14} className="mr-1" />
                                Lihat
                              </Button>
                            </li>
                          ))}
                        </ul>
                        {documents.some((doc) => doc.jenis === "SURAT_KUASA_PENUNJUKAN_PENANDATANGAN") ? null : (
                          <p className="text-xs text-muted-foreground">Surat Kuasa diperlukan bila kewenangan penandatangan tidak tercantum dalam Akta.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Belum ada dokumen onboarding.</p>
                    )}
                    {documentError ? (
                      <p role="alert" className="text-sm text-destructive">
                        {documentError}
                      </p>
                    ) : null}
                    </section>
                  </div>
                );
              })()
            : null}
          <fieldset disabled={locked || !permitted} className="space-y-4">
          {selected?.key === "perencanaan" ? (
            <Alert>
              <AlertDescription>
                {values.modelPelaksanaan === "pelaksanaan_impor_langsung"
                  ? "Lemigas menjadi importir. Tahap Settlement hanya mencatat pembayaran kepada Penyedia."
                  : values.modelPelaksanaan === "pengelolaan_manajemen_impor"
                    ? "Tentukan importir sesuai perjanjian. Dasar kerja sama dengan Penerima Pasokan wajib diunggah pada tahap Perencanaan. Settlement mencatat tagihan penerima dan pembayaran Penyedia."
                    : "Pilih model pelaksanaan untuk melihat peran importir dan tanggung jawab settlement."}
              </AlertDescription>
            </Alert>
          ) : null}
          {selected?.key === "tagihan" ? (
            <div className={`space-y-1 px-1 text-xs leading-5 ${values.__autoTagihanInfo && !invoiceSuggestion((values.pengirimanIds ?? "").split(",").filter(Boolean), values.arah ?? "", detail).contract ? "text-destructive" : "text-muted-foreground"}`}>
                {(() => {
                  const shipmentIds = (values.pengirimanIds ?? "").split(",").filter(Boolean);
                  const source = invoiceSuggestion(shipmentIds, values.arah ?? "", detail);
                  if (values.__autoTagihanInfo && !source.contract) return values.__autoTagihanInfo;
                  return (
                    <>
                      <p>{values.arah === "masuk"
                        ? `Tagihan untuk ${source.party || values.pihak || "Penerima Pasokan"}; nilai akhir mengikuti perjanjian.`
                        : `Tagihan dari ${source.party || values.pihak || "Penyedia"} kepada Lemigas. Cocokkan dengan invoice.`}</p>
                      {source.contract ? (
                        <p className="text-muted-foreground">
                          Kontrak {source.contractNumber || "aktif"} · {source.volume.toLocaleString("id-ID", { maximumFractionDigits: 4 })} {source.unit} · Nilai awal {source.suggestedValue == null ? "isi dari invoice" : `${source.currency} ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(source.suggestedValue)}`}
                          {source.priceType === "formula_harga" ? " · Harga formula, cocokkan hasil hitung invoice." : ""}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Pilih kargo dari satu kontrak Penyedia yang efektif untuk mengisi dasar tagihan.</p>
                      )}
                    </>
                  );
                })()}
            </div>
          ) : null}
          {selected?.key === "risiko" ? (
              riskShipmentForModal ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/20">
                  <p className="font-medium">{plainText(riskShipmentForModal.namaKapal) || "Kargo"} · Kontrak {plainText(object(riskShipmentForModal.kontrak).nomor) || "—"}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Tahap saat kejadian: <span className="font-medium text-foreground">{shipmentStatusLabel(plainText(riskShipmentForModal.status))}</span>. Tahap disimpan otomatis saat kejadian dicatat.</p>
                </div>
              ) : <Alert variant="destructive"><AlertDescription>Buka pencatatan dari Progres pengiriman agar kargo dan tahapnya tercatat otomatis.</AlertDescription></Alert>
            ) : null}
            {selected?.key === "rfq" ? (
              <p className="text-sm text-muted-foreground">
                {isPublicDirectPurchase
                  ? "Terbitkan RFQ publik. Vendor yang telah disetujui dapat mengirim penawaran hingga batas respons."
                  : values.mode === "baru"
                    ? "Terbitkan RFQ baru kepada vendor pilihan."
                    : values.mode === "tambah_vendor"
                      ? "Pilih RFQ aktif dan vendor baru. Ketentuan akan disalin dari RFQ acuan."
                      : "Nilai awal disalin dari RFQ pertama yang dipilih. Perubahan akan diterapkan ke seluruh vendor dan RFQ acuan terpilih sebagai revisi baru."}
              </p>
            ) : null}
            {selected?.key === "negosiasi" ? (
              <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-5 text-sky-950">
                <p>Pilih penawaran lulus evaluasi. Nomor putaran dibuat sistem. Target harga bersifat internal dan tidak ditampilkan kepada vendor.</p>
                <div className="border-t border-sky-200 pt-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">Vendor belum dicatat negosiasinya</p>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-medium">{offersWithoutNegotiation.length}</span>
                  </div>
                  {offersWithoutNegotiation.length ? (
                    <ul className="mt-1 divide-y divide-sky-200/80">
                      {offersWithoutNegotiation.map((offer) => (
                        <li key={String(offer.id)} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5">
                          <span className="font-medium">{plainText(object(offer.vendor).nama) || "Vendor"}</span>
                          <span className="text-xs text-sky-800/80">
                            {plainText(offer.nomorRfq) ? `RFQ ${plainText(offer.nomorRfq)}` : "Penawaran aktif"}
                            {offer.revisi != null ? ` · Revisi ${String(offer.revisi)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-sky-800/80">Semua vendor yang lulus sudah memiliki riwayat negosiasi.</p>
                  )}
                </div>
              </div>
            ) : null}
            {selected?.key === "penawaran" ? <p className="text-sm text-muted-foreground">Catat satu penawaran per vendor dan nomor RFQ. Ulangi hanya untuk vendor yang sudah menyampaikan penawaran.</p> : null}
            {selected?.key === "negosiasi" && values.penawaranId
              ? (() => {
                  const offer = records(detail.penawaran).find((row) => String(row.id ?? "") === values.penawaranId);
                  if (!offer) return null;
                  const participant = records(object(detail.pemilihanPenyedia).peserta).find((row) => String(row.penawaranId ?? "") === values.penawaranId);
                  const snapshot = object(object(offer.detail).rfqBaseline);
                  const negotiations = records(offer.negosiasi);
                  const nextRound = Math.max(0, ...negotiations.map((row) => Number(row.putaran) || 0)) + 1;
                  const formatAmount = (value: unknown, currency = "") => {
                    if (value == null || value === "") return "—";
                    const amount = Number(value);
                    const formatted = Number.isFinite(amount) ? new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(amount) : String(value);
                    return [currency, formatted].filter(Boolean).join(" ");
                  };
                  const currency = plainText(offer.mataUang);
                  const unit = plainText(snapshot.satuan) || plainText(object(detail.perencanaan).satuan);
                  const volume = plainText(snapshot.volume);
                  const offerNote = plainText(object(offer.detail).catatan);
                  return (
                    <section className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm" aria-label="Rincian penawaran terpilih">
                      <div className="space-y-3 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Penawaran terpilih</p>
                            <h3 className="text-base font-semibold text-slate-900">{plainText(object(offer.vendor).nama) || "Vendor"}</h3>
                          </div>
                          <span className="rounded-full border border-sky-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800">Putaran {nextRound} · otomatis</span>
                        </div>
                        <dl className="grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-500">Harga penawaran awal per satuan</dt>
                            <dd className="font-semibold text-slate-900">
                              {formatAmount(offer.hargaPenawaran, currency)}
                              {unit ? ` / ${unit}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Harga acuan evaluasi per satuan</dt>
                            <dd className="font-semibold text-slate-900">
                              {formatAmount(participant?.nilaiHargaAcuan, currency)}
                              {unit ? ` / ${unit}` : ""}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Subtotal barang awal</dt>
                            <dd className="font-semibold text-slate-900">
                              {offer.hargaPenawaran != null && volume && Number.isFinite(Number(offer.hargaPenawaran)) && Number.isFinite(Number(volume)) ? formatAmount(Number(offer.hargaPenawaran) * Number(volume), currency) : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Total biaya perolehan evaluasi</dt>
                            <dd className="font-semibold text-slate-900">{formatAmount(participant?.totalBiayaPerolehan, currency)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Volume acuan RFQ</dt>
                            <dd className="font-semibold text-slate-900">{[volume, unit].filter(Boolean).join(" ") || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Sumber harga acuan</dt>
                            <dd className="font-semibold text-slate-900">{plainText(participant?.sumberHargaAcuan) || "—"}</dd>
                          </div>
                        </dl>
                        {offer.berlakuSampai ? (
                          <p className="text-sm text-slate-600">
                            Berlaku sampai: <strong className="font-medium text-slate-900">{new Date(String(offer.berlakuSampai)).toLocaleDateString("id-ID", { dateStyle: "long" })}</strong>
                          </p>
                        ) : null}
                        {offerNote ? (
                          <p className="break-words text-sm text-slate-600">
                            Catatan: <span className="text-slate-800">{offerNote}</span>
                          </p>
                        ) : null}
                      </div>
                    </section>
                  );
                })()
              : null}
          {selected?.key === "pembayaran" && paymentInvoiceForModal ? (
            <section className="rounded-lg border bg-muted/20 px-3 py-3 text-sm">
              <p className="font-semibold">Pembayaran untuk tagihan {plainText(paymentInvoiceForModal.nomor) || "tanpa nomor"}</p>
              <p className="mt-1 text-xs text-muted-foreground">{plainText(paymentInvoiceForModal.pihak)} · Total {plainText(paymentInvoiceForModal.mataUang)} {plainText(paymentInvoiceForModal.nilai)} · Sisa {plainText(paymentInvoiceForModal.mataUang)} {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(paymentInvoiceOutstanding)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Nilai pembayaran diisi sebesar sisa tagihan. Ubah nilainya bila pembayaran dilakukan bertahap; sistem menolak jumlah yang melebihi sisa.</p>
            </section>
          ) : null}
          {selected?.key === "status-rekonsiliasi" ? (
            <ReconciliationStatusPanel
              targetStatus={values.status ?? ""}
              quantityCount={reconciliationQuantityRows.length}
              financialCount={reconciliationFinancialRows.length}
              requiredDocumentCount={relevantSettlementDocuments.length}
              fulfilledDocumentCount={relevantSettlementDocuments.filter((row) => row.terpenuhi === true).length}
            />
          ) : null}
          {selected && ["status-tagihan", "status-pembayaran"].includes(selected.key) ? (
            <p className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">Langkah yang dipilih: <strong>{selected.title}</strong>. Record terkait sudah dipilih dari checklist.</p>
          ) : null}
          {operationFieldSections(selected?.key, fields)
              .filter((section) => section.fields.length > 0)
              .map((section) => (
                <section key={section.title} className={`space-y-3 rounded-lg border bg-card p-4 ${selected && ["pengiriman", "update-pengiriman"].includes(selected.key) ? "" : "shadow-sm"}`}>
                  <div>
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    {selected?.key === "pengiriman" ? <p className="mt-1 text-xs text-muted-foreground">Alokasikan volume kargo ini. Kapal dan jadwal boleh dilengkapi belakangan jika belum diketahui.</p> : null}
                    {selected?.key === "update-pengiriman" ? <p className="mt-1 text-xs text-muted-foreground">Edit detail bukan tahap wajib. Gunakan hanya untuk melengkapi informasi yang belum tersedia atau mencatat perubahan kapal dan jadwal.</p> : null}
                    {selected?.key === "update-pengiriman" ? <p className="mt-1 text-xs text-muted-foreground">Sisa volume kontrak tetap menjadi batas total alokasi seluruh kargo.</p> : null}
                  </div>
                  <div className="grid items-start gap-x-5 gap-y-3 sm:grid-cols-2">
                    {section.fields.map((field) => {
                      if (selected?.key === "perencanaan" && field.name === "namaImportir" && values.pihakImportir !== "pihak_lain") return null;
                      const importerNameRequired = selected?.key === "perencanaan" && field.name === "namaImportir" && values.pihakImportir === "pihak_lain";
                      const recipientImporterRequired = selected?.key === "perencanaan" && field.name === "penerimaPasokan" && values.pihakImportir === "penerima_pasokan";
                      const fieldId = `${id}-${field.name}`;
                      const isSelect = !!field.relation || !!field.options || field.kind === "boolean";
                      const isLongText = field.payloadPath !== undefined;
                      const selectedContract = records(detail.kontrak).find((row) => String(row.id) === String(values.kontrakId ?? ""));
                      const deliveryField = ["pengiriman", "update-pengiriman"].includes(selected?.key ?? "");
                      const excludedShipmentId = selected?.key === "update-pengiriman" ? String(values.entityId ?? "") : undefined;
                      const allocationShipment = excludedShipmentId ? records(detail.pengiriman).find((row) => String(row.id) === excludedShipmentId) : undefined;
                      const allocationLocked = selected?.key === "update-pengiriman" && Boolean(allocationShipment && (allocationShipment.status !== "direncanakan" || records(allocationShipment.pemeriksaan).length > 0 || allocationShipment.penerimaan));
                      const allocationRemaining = selectedContract ? remainingContractVolume(selectedContract, records(detail.pengiriman), excludedShipmentId) : null;
                      const receiptShipment = selected?.key === "penerimaan" ? records(detail.pengiriman).find((row) => String(row.id) === String(values.pengirimanId ?? "")) : undefined;
                      const inspectionShipment = selected?.key === "pemeriksaan" ? records(detail.pengiriman).find((row) => String(row.id) === String(values.pengirimanId ?? "")) : undefined;
                      const statusShipment = selected?.key === "status-pengiriman" ? records(detail.pengiriman).find((row) => String(row.id) === String(values.entityId ?? "")) : undefined;
                      const currentShipmentStatus = plainText(statusShipment?.status) || "direncanakan";
                      const currentShipmentStatusIndex = shipmentStatusSteps.findIndex((step) => step.value === currentShipmentStatus);
                      const proposedShipmentStatus = values.status ?? nextShipmentStatus(currentShipmentStatus) ?? currentShipmentStatus;
                      const statusNeedsCorrection = currentShipmentStatus === "bermasalah" || (currentShipmentStatus === "diserahkan" && !shipmentHandoverComplete(statusShipment));
                      const selectedInvoiceCargoIds = selected?.key === "tagihan" && field.name === "pengirimanIds" ? (values.pengirimanIds ?? "").split(",").filter(Boolean) : [];
                      const selectedInvoiceContractId = selectedInvoiceCargoIds.length
                        ? String(records(detail.pengiriman).find((row) => String(row.id) === selectedInvoiceCargoIds[0])?.kontrakId ?? object(records(detail.pengiriman).find((row) => String(row.id) === selectedInvoiceCargoIds[0])?.kontrak).id ?? "")
                        : "";
                      const effectiveProviderContractIds = new Set(records(detail.kontrak)
                        .filter((contract) => ["efektif", "dipenuhi"].includes(String(contract.status)) && contract.jenis === "penyedia")
                        .map((contract) => String(contract.id)));
                      const invoiceShipmentChoices = options(field).filter((choice) => {
                        const shipment = records(detail.pengiriman).find((row) => String(row.id) === choice.value);
                        const contractId = String(shipment?.kontrakId ?? object(shipment?.kontrak).id ?? "");
                        if (!effectiveProviderContractIds.has(contractId)) return false;
                        if (!selectedInvoiceContractId || selectedInvoiceCargoIds.includes(choice.value)) return true;
                        return contractId === selectedInvoiceContractId;
                      });
                      const optionLabel = (value: string) => {
                        if (selected?.key === "status-pengiriman" && field.name === "status") {
                          return shipmentStatusLabel(value);
                        }
                        if (selected?.key === "pemeriksaan" && field.name === "tipe") {
                          return ({ quantity: "Kuantitas", quality: "Mutu", gabungan: "Kuantitas dan mutu" } as Record<string, string>)[value] ?? value;
                        }
                        if (selected?.key === "serah-terima" && field.name === "status") {
                          return ({ diterima: "Diterima lengkap", sebagian: "Diterima sebagian", ditolak: "Ditolak" } as Record<string, string>)[value] ?? value;
                        }
                        return selected?.key === "verifikasi" && ["selesai", "ditolak", "revisi"].includes(value)
                          ? ({ selesai: "Sesuai", ditolak: "Tidak sesuai", revisi: "Perlu perbaikan" } as Record<string, string>)[value]
                          : value.replaceAll("_", " ");
                      };
                      const fieldLabel =
                        selected?.key === "tagihan" && field.name === "nilai"
                          ? "Nilai tagihan"
                          : selected?.key === "tagihan" && field.name === "pengirimanIds"
                            ? "Kargo yang tercakup"
                          : selected?.key === "negosiasi" && field.name === "hargaHasilNegosiasi"
                          ? "Harga negosiasi per satuan"
                          : field.name === "entityId" && field.relation === "pengiriman"
                            ? "Pilih pengiriman"
                            : deliveryField && field.name === "etd"
                              ? "ETD · Kapal berangkat"
                              : deliveryField && field.name === "eta"
                                ? "ETA · Perkiraan tiba"
                              : deliveryField && field.name === "volumeRencana"
                                ? `Alokasi volume kargo${plainText(selectedContract?.satuanKontrak) ? ` (${plainText(selectedContract?.satuanKontrak)})` : ""}`
                              : selected?.key === "status-pengiriman" && field.name === "status"
                                ? "Tahap pengiriman"
                              : selected?.key === "status-pengiriman" && field.name === "volumeAktual"
                                ? `Realisasi volume pengapalan${plainText(object(statusShipment?.kontrak).satuanKontrak) ? ` (${plainText(object(statusShipment?.kontrak).satuanKontrak)})` : ""}`
                                : field.label;
                      const fullWidth =
                        (selected?.key === "tagihan" && field.name === "nomor") ||
                        (deliveryField && ["entityId", "kontrakId", "volumeRencana"].includes(field.name)) ||
                        (selected?.key === "status-pengiriman" && ["entityId", "status"].includes(field.name)) ||
                        (selected?.key === "penyimpanan" && field.name === "penerimaanId") ||
                        (selected?.key === "serah-terima" && field.name === "pengirimanId") ||
                        (selected?.key === "tagihan" && field.name === "pengirimanIds") ||
                        (field.kind === "json" || field.kind === "textarea") ||
                        (selected?.key === "pemeriksaan" && ["pengirimanId", "hasilMutu", "catatan"].includes(field.name)) ||
                        (selected?.key === "penerimaan" && ["pengirimanId", "mutuDiterima", "catatan"].includes(field.name)) ||
                        (selected?.key === "rfq" && ["vendorIds", "rfqId", "rfqIds", "alasanPerubahan", "spesifikasi", "syaratPenyerahan", "syaratPembayaran", "dokumenDiminta"].includes(field.name)) ||
                        (selected?.key === "negosiasi" && ["penawaranId", "hasil"].includes(field.name)) ||
                        (selected?.key === "verifikasi" && ["kepatuhan", "hasil", "catatan"].includes(field.name));
                      return (
                        <div
                          key={field.name}
                          className={`min-w-0 space-y-1.5${fullWidth ? " sm:col-span-2" : ""}`}
                        >
                          <Label htmlFor={fieldId} className="block min-h-0 leading-5">
                            {fieldLabel}
                            {field.required ? " *" : ""}
                          </Label>
                          {selected?.key === "rekonsiliasi" && field.name === "catatan" ? (
                            <p className="text-xs leading-5 text-muted-foreground">Tuliskan keputusan atas selisih yang ditemukan, alasan saldo yang belum dapat dicocokkan, atau tindak lanjut yang disepakati. Angka ringkasan di atas dihitung otomatis.</p>
                          ) : null}
                          {selected?.key === "negosiasi" && field.name === "batasNegosiasi" ? (
                            <p className="min-h-8 text-xs leading-4 text-muted-foreground">Opsional. Harga per satuan untuk acuan internal; tidak dikirim kepada vendor.</p>
                          ) : null}
                          {selected?.key === "negosiasi" && field.name === "hargaHasilNegosiasi" ? (
                            <p className="min-h-8 text-xs leading-4 text-muted-foreground">Isi harga per satuan, bukan total volume. Mata uang dan satuan mengikuti penawaran.</p>
                          ) : null}
                          {deliveryField && field.name === "volumeRencana" && selectedContract ? (
                            <p className="text-xs text-muted-foreground">
                              {allocationLocked
                                ? "Alokasi terkunci setelah kargo dimuat, diperiksa, atau diterima."
                                : allocationRemaining == null
                                ? "Volume total belum tersedia pada kontrak."
                                : allocationRemaining < 0
                                  ? `Alokasi kargo lain sudah melebihi volume kontrak sebesar ${formatQuantity(Math.abs(allocationRemaining), selectedContract.satuanKontrak)}. Kurangi alokasi sebelum menambah kargo.`
                                  : `Sisa volume kontrak yang dapat dialokasikan: ${formatQuantity(allocationRemaining, selectedContract.satuanKontrak)}. Alokasi seluruh kargo tidak boleh melebihi volume kontrak.`}
                            </p>
                          ) : null}
                          {selected?.key === "status-pengiriman" && field.name === "volumeAktual" ? (
                            <p className="text-xs text-muted-foreground">Catat realisasi volume pengapalan di sini. Hasil pemeriksaan dan kuantitas BAST dicatat terpisah.</p>
                          ) : null}
                          {selected?.key === "pemeriksaan" && field.name === "hasilKuantitas" ? (
                            <p className="text-xs text-muted-foreground">Masukkan hasil ukur sesuai titik pemeriksaan dalam kontrak. Sebutkan lokasinya di Catatan, misalnya pelabuhan muat atau titik bongkar. Jika berbeda dari alokasi {formatQuantity(inspectionShipment?.volumeRencana, object(inspectionShipment?.kontrak).satuanKontrak)}, jelaskan selisihnya.</p>
                          ) : null}
                          {selected?.key === "penerimaan" && field.name === "kuantitasDiterima" && receiptShipment ? (
                            <p className="text-xs text-muted-foreground">
                              {Number(values.kuantitasDiterima) === Number(receiptShipment.volumeRencana)
                                ? `Alokasi kargo: ${formatQuantity(receiptShipment.volumeRencana, object(receiptShipment.kontrak).satuanKontrak)}.`
                                : `Alokasi kargo: ${formatQuantity(receiptShipment.volumeRencana, object(receiptShipment.kontrak).satuanKontrak)}. Jika jumlah BAST berbeda, tandai “Ada catatan” dan jelaskan selisihnya.`}
                            </p>
                          ) : null}
                          {selected?.key === "status-pengiriman" && field.name === "status" ? (
                            <div className="space-y-3">
                              <input type="hidden" value={values.status ?? ""} />
                              {statusNeedsCorrection ? (
                                <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                                  <div>
                                    <p className="text-sm font-medium">{currentShipmentStatus === "bermasalah" ? "Pengiriman ditandai bermasalah" : "Status Diserahkan belum didukung checklist lengkap"}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Pilih tahap terakhir yang benar-benar tercapai. Status Diserahkan hanya boleh dipakai setelah jumlah serah-terima sama dengan BAST.</p>
                                  </div>
                                  <Select value={values.status ?? ""} onValueChange={(value) => setValues((old) => ({ ...old, status: String(value ?? "") }))} disabled={locked || !permitted}>
                                    <SelectTrigger id={fieldId} aria-required={field.required}>
                                      <SelectValue placeholder="Pilih tahap untuk melanjutkan" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {shipmentStatusSteps.filter((step) => step.value !== "diserahkan" || shipmentHandoverComplete(statusShipment)).map((step) => <SelectItem key={step.value} value={step.value}>{step.label}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const riskOperation = available.find((operation) => operation.key === "risiko");
                                      if (riskOperation && statusShipment) open(riskOperation, undefined, statusShipment);
                                    }}
                                  >
                                    Catat kejadian pada kargo ini
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="rounded-lg border bg-muted/20 p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                      <span className="text-muted-foreground">Posisi sekarang</span>
                                      <span className="font-medium text-foreground">{shipmentStatusLabel(currentShipmentStatus)}</span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                                      {shipmentStatusSteps.map((step, index) => {
                                        const complete = index < currentShipmentStatusIndex;
                                        const current = index === currentShipmentStatusIndex;
                                        return (
                                          <div key={step.value} className="min-w-0 text-center">
                                            <span className={`mx-auto grid size-6 place-items-center rounded-full text-[10px] font-semibold ${complete ? "bg-emerald-600 text-white" : current ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>
                                              {complete ? <Check size={13} /> : index + 1}
                                            </span>
                                            <span className={`mt-1 block text-[10px] leading-4 ${current ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  {proposedShipmentStatus === "bermasalah" ? (
                                    <Alert variant="destructive"><AlertDescription>Status akan ditandai bermasalah. Catat rincian kejadian pada kargo ini agar tahap dan dampaknya ikut tercatat.</AlertDescription></Alert>
                                  ) : proposedShipmentStatus === "diserahkan" && !shipmentHandoverComplete(statusShipment) ? (
                                    <Alert variant="destructive"><AlertDescription>Lengkapi catatan serah-terima sampai jumlahnya sama dengan BAST sebelum menandai kargo diserahkan.</AlertDescription></Alert>
                                  ) : nextShipmentStatus(currentShipmentStatus) ? (
                                    <p className="text-xs text-muted-foreground">Simpan untuk maju satu tahap: <span className="font-medium text-foreground">{shipmentStatusLabel(proposedShipmentStatus)}</span>. Volume aktual di bawah dicatat saat hasil pemuatan tersedia.</p>
                                  ) : (
                                    <p className="text-xs text-emerald-700">Tahap pengiriman ini sudah selesai.</p>
                                  )}
                                  <p className="text-xs text-muted-foreground">Status hanya menandai progres kargo. Hasil pemeriksaan, BAST, dan bukti serah-terima tetap dicatat pada checklist masing-masing.</p>
                                  {statusShipment ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const riskOperation = available.find((operation) => operation.key === "risiko");
                                        if (riskOperation) open(riskOperation, undefined, statusShipment);
                                      }}
                                    >
                                      Catat kejadian pada tahap ini
                                    </Button>
                                  ) : null}
                                  {nextShipmentStatus(currentShipmentStatus) ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setValues((old) => ({ ...old, status: old.status === "bermasalah" ? nextShipmentStatus(currentShipmentStatus)! : "bermasalah" }))}
                                    >
                                      {proposedShipmentStatus === "bermasalah" ? "Batalkan tanda bermasalah" : "Tandai bermasalah"}
                                    </Button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          ) : field.multiple && field.relation && field.relation !== "vendor" ? (
                            <div className="space-y-2">
                              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
                                {(values[field.name] ?? "")
                                  .split(",")
                                  .filter(Boolean)
                                  .map((choiceId) => {
                                    const choice = options(field).find((item) => item.value === choiceId);
                                    return (
                                      <span key={choiceId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                        {choice?.label ?? choiceId}
                                        <button
                                          type="button"
                                          aria-label={`Hapus ${field.label}`}
                                          disabled={locked}
                                          onClick={() =>
                                            setValues((old) => ({
                                              ...old,
                                              [field.name]: (old[field.name] ?? "")
                                                .split(",")
                                                .filter((value) => value && value !== choiceId)
                                                .join(","),
                                            }))
                                          }
                                        >
                                          <X size={13} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                {!values[field.name] ? <span className="px-1 text-xs text-muted-foreground">Pilih satu atau beberapa RFQ</span> : null}
                              </div>
                              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1" role="group" aria-label={field.label}>
                                {options(field).map((choice) => {
                                  const selectedIds = (values[field.name] ?? "").split(",").filter(Boolean);
                                  const checked = selectedIds.includes(choice.value);
                                  return (
                                    <button
                                      key={choice.value}
                                      type="button"
                                      disabled={locked}
                                      onClick={() => setValues((old) => ({ ...old, [field.name]: checked ? selectedIds.filter((value) => value !== choice.value).join(",") : [...selectedIds, choice.value].join(",") }))}
                                      className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                    >
                                      <span>{choice.label}</span>
                                      {checked ? <Check size={16} className="text-primary" /> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : field.multiple && field.relation === "vendor" ? (
                            <div className="space-y-2">
                              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
                                {(values[field.name] ?? "")
                                  .split(",")
                                  .filter(Boolean)
                                  .map((vendorId) => {
                                    const choice = options(field).find((item) => item.value === vendorId);
                                    return (
                                      <span key={vendorId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                        {choice?.label ?? vendorId}
                                        <button
                                          type="button"
                                          aria-label={`Hapus ${choice?.label ?? "vendor"}`}
                                          disabled={locked}
                                          onClick={() =>
                                            setValues((old) => ({
                                              ...old,
                                              [field.name]: (old[field.name] ?? "")
                                                .split(",")
                                                .filter((id) => id && id !== vendorId)
                                                .join(","),
                                            }))
                                          }
                                        >
                                          <X size={13} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                <span className="px-1 text-xs text-muted-foreground">{(values[field.name] ?? "").split(",").filter(Boolean).length ? "Vendor dipilih" : "Pilih vendor di bawah"}</span>
                              </div>
                              <Input
                                placeholder="Cari vendor…"
                                aria-label="Cari vendor tujuan"
                                value={values.__vendorSearch ?? ""}
                                disabled={locked || vendorBlocked}
                                onChange={(event) => setValues((old) => ({ ...old, __vendorSearch: event.target.value }))}
                              />
                              <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-1" role="group" aria-label="Vendor tujuan">
                                {options(field)
                                  .filter((choice) => choice.label.toLocaleLowerCase("id-ID").includes((values.__vendorSearch ?? "").toLocaleLowerCase("id-ID")))
                                  .map((choice) => {
                                    const selectedIds = (values[field.name] ?? "").split(",").filter(Boolean);
                                    const checked = selectedIds.includes(choice.value);
                                    return (
                                      <button
                                        key={choice.value}
                                        type="button"
                                        disabled={locked}
                                        onClick={() => setValues((old) => ({ ...old, [field.name]: checked ? selectedIds.filter((id) => id !== choice.value).join(",") : [...selectedIds, choice.value].join(",") }))}
                                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                                      >
                                        <span>{choice.label}</span>
                                        {checked ? <Check size={16} className="text-primary" /> : null}
                                      </button>
                                    );
                                  })}
                                {!vendorBlocked && !options(field).some((choice) => choice.label.toLocaleLowerCase("id-ID").includes((values.__vendorSearch ?? "").toLocaleLowerCase("id-ID"))) ? (
                                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">Vendor tidak ditemukan.</p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={locked || vendorBlocked}
                                  onClick={() =>
                                    setValues((old) => ({
                                      ...old,
                                      [field.name]: options(field)
                                        .map((choice) => choice.value)
                                        .join(","),
                                    }))
                                  }
                                >
                                  Pilih semua ({options(field).length})
                                </Button>
                                <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={() => setValues((old) => ({ ...old, [field.name]: "" }))}>
                                  Kosongkan pilihan
                                </Button>
                              </div>
                            </div>
                          ) : isSelect && field.relation === "vendor" ? (
                            <FilterCombobox
                              options={options(field)}
                              value={values[field.name] || ""}
                              onValueChange={(value) => setValues((old) => ({ ...old, [field.name]: value }))}
                              label={field.label}
                              disabled={locked || !permitted || vendorBlocked}
                            />
                          ) : isSelect && field.relation === "kontrak" ? (
                            <FilterCombobox
                              options={options(field)}
                              value={values[field.name] || ""}
                              onValueChange={(value) => {
                                const contract = records(detail.kontrak).find((row) => String(row.id) === value);
                                setValues((old) => {
                                  const nextValues = { ...old, [field.name]: value };
                                  if (deliveryField && contract) {
                                    const excludeId = selected?.key === "update-pengiriman" ? String(old.entityId ?? "") : undefined;
                                    const remaining = remainingContractVolume(contract, records(detail.pengiriman), excludeId);
                                    nextValues.volumeRencana = remaining == null ? "" : String(Math.max(0, Math.round(remaining * 10_000) / 10_000));
                                  }
                                  return nextValues;
                                });
                              }}
                              label={field.label}
                              searchPlaceholder="Cari nomor kontrak atau vendor…"
                              emptyLabel="Pilih nomor kontrak"
                              disabled={locked || !permitted || (deliveryField && allocationLocked)}
                            />
                          ) : field.multiple && field.relation === "pengiriman" ? (
                            <div className="space-y-2">
                              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background p-2">
                                {(values[field.name] ?? "")
                                  .split(",")
                                  .filter(Boolean)
                                  .map((shipmentId) => {
                                    const choice = invoiceShipmentChoices.find((item) => item.value === shipmentId);
                                    return (
                                      <span key={shipmentId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                                        {choice?.label ?? shipmentId}
                                        <button
                                          type="button"
                                          aria-label={`Hapus ${choice?.label ?? "kargo"}`}
                                          disabled={locked}
                                          onClick={() => updateTagihanCargoSelection((values[field.name] ?? "").split(",").filter((id) => id && id !== shipmentId))}
                                        >
                                          <X size={13} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                {!values[field.name] ? <span className="px-1 text-xs text-muted-foreground">Pilih satu atau beberapa kargo</span> : null}
                              </div>
                              <FilterCombobox
                                options={invoiceShipmentChoices.filter((choice) => !(values[field.name] ?? "").split(",").includes(choice.value))}
                                value=""
                                onValueChange={(value) => updateTagihanCargoSelection([...(values[field.name] ?? "").split(",").filter(Boolean), value])}
                                label={field.label}
                                searchPlaceholder="Cari kapal, bill of lading, atau kontrak…"
                                emptyLabel={selectedInvoiceContractId ? "Semua kargo dari kontrak ini sudah dipilih" : "Tidak ada kargo dari kontrak Penyedia efektif atau dipenuhi"}
                                disabled={locked || !permitted || !invoiceShipmentChoices.some((choice) => !(values[field.name] ?? "").split(",").includes(choice.value))}
                              />
                            </div>
                          ) : isSelect && field.relation === "pengiriman" ? (
                            <FilterCombobox
                              options={options(field)}
                              value={values[field.name] || ""}
                              onValueChange={(value) => setValues((old) => ({ ...old, [field.name]: value }))}
                              label={field.name === "entityId" ? "pengiriman" : field.label}
                              searchPlaceholder="Cari kapal, bill of lading, atau kontrak…"
                              emptyLabel="Pilih pengiriman"
                              disabled={locked || !permitted || (selected?.key === "risiko" && field.name === "pengirimanId")}
                            />
                          ) : isSelect && field.relation === "penerimaan" ? (
                            <FilterCombobox
                              options={options(field)}
                              value={values[field.name] || ""}
                              onValueChange={(value) => setValues((old) => ({ ...old, [field.name]: value }))}
                              label={field.label}
                              searchPlaceholder="Cari nomor BAST atau nama kapal…"
                              emptyLabel="Pilih penerimaan / BAST"
                              disabled={locked || !permitted}
                            />
                          ) : isSelect ? (
                            <Select
                              value={values[field.name] || ""}
                              onValueChange={(value) => {
                                if (selected?.key === "tagihan" && field.name === "arah") {
                                  updateTagihanCargoSelection((values.pengirimanIds ?? "").split(",").filter(Boolean), String(value ?? ""));
                                } else if (selected?.key === "perencanaan" && field.name === "modelPelaksanaan") {
                                  setValues((old) => ({ ...old, modelPelaksanaan: String(value ?? ""), pihakImportir: value === "pelaksanaan_impor_langsung" ? "lemigas" : old.pihakImportir ?? "" }));
                                } else {
                                  setValues((old) => ({ ...old, [field.name]: String(value ?? "") }));
                                }
                              }}
                              disabled={locked || !permitted}
                            >
                              <SelectTrigger id={fieldId} aria-required={field.required} className={selected?.key === "negosiasi" && field.name === "penawaranId" ? "min-w-0" : undefined}>
                                {selected?.key === "negosiasi" && field.name === "penawaranId" ? (
                                  <>
                                    <span className="min-w-0 flex-1 truncate text-left">{options(field).find((option) => option.value === values[field.name])?.label ?? "Pilih penawaran vendor…"}</span>
                                    <SelectValue className="sr-only" />
                                  </>
                                ) : (
                                  <SelectValue placeholder={field.kind === "boolean" ? "Pilih ya atau tidak" : `Pilih ${field.label.toLocaleLowerCase("id-ID")}…`} />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {!field.required ? <SelectItem value="">Tidak diisi</SelectItem> : null}
                                {options(field).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {selected?.key === "rfq" && field.name === "mode" ? (({ baru: "RFQ baru", tambah_vendor: "Tambah vendor", revisi: "Ubah RFQ" } as Record<string, string>)[option.value] ?? option.label) : optionLabel(option.value)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : field.kind === "document-list" ? (
                            <div className="space-y-3" aria-describedby={`${fieldId}-hint`}>
                              <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
                                Cantumkan dokumen yang wajib disampaikan vendor beserta ketentuannya.
                              </p>
                              <div className="space-y-2">
                                {parseParameterRows(values[field.name] ?? "").map((row, index, rows) => (
                                  <div key={`${fieldId}-row-${index}`} className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`${fieldId}-name-${index}`} className="text-xs">
                                        Nama dokumen
                                      </Label>
                                      <Input
                                        id={`${fieldId}-name-${index}`}
                                        aria-label={`${field.label}: nama dokumen ${index + 1}`}
                                        placeholder="Contoh: Surat penawaran harga"
                                        value={row.name}
                                        onChange={(event) => {
                                          const next = [...rows];
                                          next[index] = { ...row, name: event.target.value };
                                          setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                        }}
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label htmlFor={`${fieldId}-detail-${index}`} className="text-xs">
                                        Ketentuan / keterangan
                                      </Label>
                                      <Input
                                        id={`${fieldId}-detail-${index}`}
                                        aria-label={`${field.label}: ketentuan dokumen ${index + 1}`}
                                        placeholder="Contoh: Wajib, ditandatangani pejabat berwenang"
                                        value={row.value}
                                        onChange={(event) => {
                                          const next = [...rows];
                                          next[index] = { ...row, value: event.target.value };
                                          setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                        }}
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      aria-label={`Hapus dokumen ${index + 1}`}
                                      disabled={rows.length === 1}
                                      onClick={() => {
                                        const next = rows.filter((_, rowIndex) => rowIndex !== index);
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    >
                                      Hapus
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const next = [...parseParameterRows(values[field.name] ?? ""), { name: "", value: "" }];
                                  setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                }}
                              >
                                Tambah dokumen
                              </Button>
                            </div>
                          ) : field.kind === "json" ? (
                            <div className="space-y-3" aria-describedby={`${fieldId}-hint`}>
                              <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
                                {field.name === "hasilMutu" || field.name === "mutuDiterima"
                                  ? "Catat hasil uji mutu, misalnya kadar sulfur, densitas, atau viskositas."
                                  : field.name === "kesiapanPenerima"
                                    ? "Isi parameter dan nilai, misalnya fasilitas, kapasitas, atau jadwal penerimaan."
                                    : field.name === "analisisPasar"
                                      ? "Isi parameter dan nilai, misalnya pasokan, harga, atau risiko pasar."
                                      : "Isi setiap parameter beserta nilainya."}
                              </p>
                              <div className="space-y-2">
                                {parseParameterRows(values[field.name] ?? "").map((row, index, rows) => (
                                  <div key={`${fieldId}-row-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
                                    <Input
                                      aria-label={`${field.label}: parameter ${index + 1}`}
                                      placeholder={field.name === "hasilMutu" || field.name === "mutuDiterima" ? "Contoh: Kadar sulfur" : "Parameter"}
                                      value={row.name}
                                      onChange={(event) => {
                                        const next = [...rows];
                                        next[index] = { ...row, name: event.target.value };
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    />
                                    <Input
                                      aria-label={`${field.label}: nilai ${index + 1}`}
                                      placeholder={field.name === "hasilMutu" || field.name === "mutuDiterima" ? "Contoh: 0,5%" : "Nilai"}
                                      value={row.value}
                                      onChange={(event) => {
                                        const next = [...rows];
                                        next[index] = { ...row, value: event.target.value };
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      aria-label={`Hapus parameter ${index + 1}`}
                                      className={rows.length === 1 ? "hidden" : undefined}
                                      disabled={rows.length === 1}
                                      onClick={() => {
                                        const next = rows.filter((_, rowIndex) => rowIndex !== index);
                                        setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                      }}
                                    >
                                      Hapus
                                    </Button>
                                  </div>
                                ))}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const next = [...parseParameterRows(values[field.name] ?? ""), { name: "", value: "" }];
                                  setValues((old) => ({ ...old, [field.name]: serializeParameterRows(next) }));
                                }}
                              >
                                Tambah parameter
                              </Button>
                            </div>
                          ) : isLongText || field.kind === "textarea" ? (
                            <textarea
                              id={fieldId}
                              value={values[field.name] ?? ""}
                              onChange={(event) => setValues((old) => ({ ...old, [field.name]: event.target.value }))}
                              required={field.required || importerNameRequired || recipientImporterRequired}
                              rows={3}
                              placeholder={`${field.label}…`}
                              className="w-full rounded-md border border-input bg-background p-3 text-sm leading-6"
                            />
                          ) : (
                            <Input
                              id={fieldId}
                              type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"}
                              step={field.kind === "number" ? (field.integer ? "1" : ["volumeRencana", "volumeAktual", "hasilKuantitas", "kuantitasDiterima", "kuantitasDiserahkan"].includes(field.name) ? "0.0001" : "any") : undefined}
                              min={field.min}
                              maxLength={field.maxLength}
                              required={field.required || importerNameRequired || recipientImporterRequired}
                              disabled={locked || !permitted || (deliveryField && field.name === "volumeRencana" && allocationLocked)}
                              value={values[field.name] ?? ""}
                              onChange={(event) => setValues((old) => ({ ...old, [field.name]: event.target.value }))}
                              placeholder={field.name === "namaKapal" ? "Contoh: MT Nusantara" : field.name === "nomorBillOfLading" ? "Masukkan nomor bill of lading" : field.name === "pelabuhanMuat" ? "Contoh: Ras Tanura" : field.name === "pelabuhanBongkar" ? "Contoh: Tanjung Priok" : field.name === "volumeRencana" ? "Masukkan volume yang dialokasikan ke kargo ini" : undefined}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            {selected?.key === "serah-terima" ? (
              <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                <div>
                  <h3 className="text-sm font-semibold">Bukti serah-terima *</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Unggah dokumen yang membuktikan penyerahan. Nomor dokumen boleh dikosongkan jika sudah tercantum di berkas.</p>
                </div>
                <UploadDocumentField
                  id={`${id}-handover-evidence`}
                  key={`${id}-handover-evidence-${selected.key}`}
                  accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
                  disabled={locked || !permitted}
                  helperText="PDF atau gambar JPG, PNG, WebP · maksimal 10 MB"
                  onFileChange={setHandoverEvidence}
                />
              </section>
            ) : null}
          </fieldset>
        </form>
      </Modal>
    </section>
  );
}

export default LifecycleOperations;
