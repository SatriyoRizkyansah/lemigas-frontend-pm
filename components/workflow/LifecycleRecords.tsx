"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCurrentUser } from "@/lib/api/hooks";
import { DataTable } from "@/components/table/DataTable";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/loading/EmptyState";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { ContentType } from "@/lib/api/generated/api-generated";
type RecordData = Record<string, any>;
const auditTables: Record<string, string> = {
  perencanaan: "perencanaan_kebutuhan",
  strategi: "strategi_transaksi",
  rfq: "rfq",
  penawaran: "penawaran_vendor",
  verifikasi: "verifikasi_vendor",
  negosiasi: "negosiasi_transaksi",
  memorandum: "memorandum_keputusan",
  kontrak: "kontrak",
  adendum: "adendum_kontrak",
  pengiriman: "pengiriman_kargo",
  pemeriksaan: "pemeriksaan_kargo",
  penerimaan: "penerimaan_kargo",
  penyimpanan: "penyimpanan_kargo",
  dokumenOperasional: "dokumen_operasional",
  risiko: "risiko_transaksi",
  tagihan: "tagihan",
  pembayaran: "pembayaran",
  rekonsiliasi: "rekonsiliasi",
  klaim: "klaim_transaksi",
  laporan: "laporan_transaksi",
};
const auditUrl = (tabel: string, recordId: string) => `/dashboard/audit-log?${new URLSearchParams({ tabel, recordId, mode: "record" })}`;
const sections: Record<string, Array<[string, string]>> = {
  perencanaan: [
    ["perencanaan", "Kebutuhan transaksi"],
    ["strategi", "Strategi sourcing"],
  ],
  sourcing: [
    ["rfq", "RFQ"],
    ["penawaran", "Penawaran vendor"],
  ],
  evaluasi_negosiasi: [
    ["verifikasi", "Verifikasi vendor"],
    ["negosiasi", "Hasil negosiasi"],
  ],
  approval: [
    ["memorandum", "Memorandum"],
    ["approvalSteps", "Riwayat approval"],
  ],
  kontrak: [
    ["kontrak", "Kontrak"],
    ["adendum", "Adendum kontrak"],
  ],
  delivery: [
    ["pengiriman", "Pengiriman"],
    ["pemeriksaan", "Pemeriksaan"],
    ["penerimaan", "Penerimaan"],
    ["penyimpanan", "Penyimpanan"],
    ["dokumenOperasional", "Dokumen operasional"],
    ["risiko", "Risiko dan tindak lanjut"],
  ],
  settlement: [
    ["tagihan", "Tagihan"],
    ["pembayaran", "Pembayaran"],
    ["rekonsiliasi", "Rekonsiliasi"],
    ["klaim", "Klaim"],
  ],
  selesai: [["laporan", "Laporan transaksi"]],
};
const list = (value: any): RecordData[] => (Array.isArray(value) ? value : value ? [value] : []);
const text = (value: any): string => (value == null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value));
const date = (value: any) => (value ? new Date(value).toLocaleString("id-ID") : "—");

export function LifecycleRecords({ stage, active, pengadaanId, detail }: { stage: string; active: boolean; pengadaanId: string; detail: RecordData }) {
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [jenisDraft, setJenisDraft] = useState<Record<string, string>>({});
  const user = useCurrentUser();
  const updateContractType = use_mutation<unknown, Error, { id: string; jenis: string }>({
    tag: "siklusTransaksiKomoditas",
    method: "updateContractType",
    invalidateKeys: [apiQueryKeys.resource("siklusTransaksiKomoditas"), apiQueryKeys.resource("lifecycleHistory"), apiQueryKeys.resource("lifecycleEvidence")],
    mutationFn: async ({ id, jenis }) => {
      setBrowserToken();
      return apiData(
        browserApi.request({
          path: `/api/pengadaan/${encodeURIComponent(pengadaanId)}/kontrak/${encodeURIComponent(id)}/jenis`,
          method: "PUT",
          body: { jenis },
          secure: true,
          type: ContentType.Json,
          format: "json",
        }) as Promise<{ data: unknown }>,
      );
    },
  });
  const canAudit = user.isSuccess && !user.isRefetchError && ["admin", "pimpinan"].includes(user.data.role.toLowerCase());
  const derived: RecordData = {
    ...detail,
    negosiasi: list(detail.penawaran).flatMap((offer) => list(offer.negosiasi).map((row) => ({ ...row, vendor: offer.vendor, penawaranId: offer.id }))),
    adendum: list(detail.kontrak).flatMap((contract) => list(contract.adendum).map((row) => ({ ...row, nomorKontrak: contract.nomor }))),
    pemeriksaan: list(detail.pengiriman).flatMap((shipment) => list(shipment.pemeriksaan).map((row) => ({ ...row, nomorBillOfLading: shipment.nomorBillOfLading, pengirimanId: shipment.id }))),
  };
  const currentSelected = selected?.id
    ? (Object.values(derived)
        .flatMap((value) => list(value))
        .find((row) => row.id === selected.id) ?? selected)
    : selected;
  const comparison: RecordData[] = list(detail.penawaran).map((offer) => {
    const latest = [...list(offer.negosiasi)].sort((a, b) => Number(b.putaran) - Number(a.putaran) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
    return {
      ...offer,
      vendorName: offer.vendor?.nama ?? offer.vendorId,
      verification:
        list(detail.verifikasi)
          .filter((row) => row.vendorId === offer.vendorId)
          .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0]?.hasil ?? "Belum diverifikasi",
      putaran: latest?.putaran,
      totalBiayaPerolehan: latest?.totalBiayaPerolehan,
      hasil: latest?.hasil,
    };
  });
  return (
    <div className="space-y-6">
      {canAudit && detail.id && (
        <Link className="text-sm underline" href={auditUrl("pengadaan", detail.id)}>
          Audit record pengadaan
        </Link>
      )}
      {(stage === "sourcing" || stage === "evaluasi_negosiasi") && (
        <details className="group rounded-lg border px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
            Perbandingan penawaran
            <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 border-t py-4">
            <p className="text-xs text-muted-foreground">Biaya menggunakan mata uang masing-masing; tanpa konversi kurs atau peringkat otomatis. Negosiasi memakai putaran tertinggi.</p>
            <DataTable
              rows={comparison}
              rowKey={(row) => row.id}
              emptyMessage="Belum ada penawaran."
              columns={[
                { key: "vendorName", header: "Vendor", render: (row) => text(row.vendorName) },
                { key: "nomorRfq", header: "RFQ", render: (row) => text(row.nomorRfq) },
                { key: "hargaAcuan", header: "Harga acuan", render: (row) => text(row.hargaAcuan) },
                { key: "diferensialHarga", header: "Diferensial", render: (row) => text(row.diferensialHarga) },
                { key: "hargaPenawaran", header: "Penawaran", render: (row) => text(row.hargaPenawaran) },
                { key: "mataUang", header: "Mata uang", render: (row) => text(row.mataUang) },
                { key: "verification", header: "Verifikasi", render: (row) => text(row.verification) },
                { key: "putaran", header: "Putaran", render: (row) => text(row.putaran) },
                { key: "totalBiayaPerolehan", header: "Total biaya perolehan", render: (row) => text(row.totalBiayaPerolehan) },
                { key: "hasil", header: "Hasil negosiasi", render: (row) => text(row.hasil) },
                {
                  key: "detail",
                  header: "Detail",
                  render: (row) => (
                    <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                      Lihat
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </details>
      )}
      {(sections[stage] ?? []).map(([key, title]) => {
        const rows: RecordData[] = list(derived[key]).map((row) => ({
          ...row,
          ringkasan: row.nomor ?? row.nomorRfq ?? row.nomorBast ?? row.namaKapal ?? row.jenisKargo ?? row.kategori ?? row.jenis ?? row.metodeSeleksi ?? row.id,
          pihak: row.vendor?.nama ?? row.penanggungJawabUser?.nama ?? row.nomorKontrak ?? row.vendorId ?? row.dibuatOleh ?? row.diunggahOleh ?? "—",
        }));
        return (
          <details className="group rounded-lg border px-4" key={key}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium [&::-webkit-details-marker]:hidden">
              <span>
                {title}
                <span className="ml-2 text-xs font-normal text-muted-foreground">({rows.length})</span>
              </span>
              <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t py-4">
              {rows.length ? (
                <DataTable
                  rows={rows}
                  rowKey={(row, index) => row.id ?? index}
                  columns={[
                    { key: "ringkasan", header: "Record", render: (row) => text(row.ringkasan) },
                    { key: "pihak", header: "Pihak / relasi", render: (row) => text(row.pihak) },
                    { key: "status", header: "Status", render: (row) => text(row.status ?? row.hasil) },
                    ...(key === "kontrak"
                      ? [
                          {
                            key: "jenisKontrak",
                            header: "Jenis kontrak",
                            render: (row: RecordData) => (
                              <div className="flex min-w-56 items-center gap-2">
                                <select
                                  aria-label={`Jenis kontrak ${row.nomor ?? row.id}`}
                                  value={jenisDraft[row.id] ?? row.jenis ?? ""}
                                  onChange={(event) => setJenisDraft((old) => ({ ...old, [row.id]: event.target.value }))}
                                  disabled={!active || updateContractType.isPending || !["admin", "operator"].includes(user.data?.role.toLowerCase() ?? "")}
                                  className="rounded-md border bg-background p-2 text-sm"
                                >
                                  <option value="penyedia">Penyedia</option>
                                  <option value="kerja_sama_penerima_pasokan">PKS penerima pasokan</option>
                                </select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!active || updateContractType.isPending || !["admin", "operator"].includes(user.data?.role.toLowerCase() ?? "") || !jenisDraft[row.id] || jenisDraft[row.id] === row.jenis}
                                  onClick={() =>
                                    updateContractType.mutate(
                                      { id: row.id, jenis: jenisDraft[row.id] },
                                      {
                                        onSuccess: () =>
                                          setJenisDraft((old) => {
                                            const next = { ...old };
                                            delete next[row.id];
                                            return next;
                                          }),
                                      },
                                    )
                                  }
                                >
                                  Simpan jenis
                                </Button>
                              </div>
                            ),
                          },
                        ]
                      : []),
                    ...(key === "kontrak"
                      ? [
                          { key: "tanggalTandaTangan", header: "Tanggal tanda tangan", render: (row: RecordData) => date(row.tanggalTandaTangan) },
                          { key: "mulaiBerlaku", header: "Mulai berlaku", render: (row: RecordData) => date(row.mulaiBerlaku) },
                          { key: "berakhirPada", header: "Berakhir", render: (row: RecordData) => date(row.berakhirPada) },
                        ]
                      : []),
                    { key: "createdAt", header: "Dicatat", render: (row) => date(row.createdAt) },
                    { key: "updatedAt", header: "Diperbarui", render: (row) => date(row.updatedAt ?? row.tanggalKeputusan) },
                    {
                      key: "detail",
                      header: "Detail",
                      render: (row) => (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>
                            Lihat
                          </Button>
                          {canAudit && row.id && auditTables[key] && (
                            <Link className="text-sm underline" href={auditUrl(auditTables[key], row.id)}>
                              Audit record
                            </Link>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
              ) : (
                <EmptyState title={`Belum ada ${title.toLowerCase()}`} description="Record akan tampil setelah dicatat." />
              )}
            </div>
          </details>
        );
      })}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detail record"
        size="md"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Tutup
          </Button>
        }
      >
        <dl className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
          {Object.entries(currentSelected ?? {}).map(([key, value]) => (
            <div key={key}>
              <dt className="font-medium break-all">{key}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-all text-muted-foreground">{typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : text(value)}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}
