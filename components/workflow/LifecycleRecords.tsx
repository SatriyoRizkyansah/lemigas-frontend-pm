"use client";

import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/loading/EmptyState";

type RecordData = Record<string, any>;
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

export function LifecycleRecords({ stage, detail }: { stage: string; detail: RecordData }) {
  const [selected, setSelected] = useState<RecordData | null>(null);
  const derived: RecordData = {
    ...detail,
    negosiasi: list(detail.penawaran).flatMap((offer) => list(offer.negosiasi).map((row) => ({ ...row, vendor: offer.vendor, penawaranId: offer.id }))),
    adendum: list(detail.kontrak).flatMap((contract) => list(contract.adendum).map((row) => ({ ...row, nomorKontrak: contract.nomor }))),
    pemeriksaan: list(detail.pengiriman).flatMap((shipment) => list(shipment.pemeriksaan).map((row) => ({ ...row, nomorBillOfLading: shipment.nomorBillOfLading, pengirimanId: shipment.id }))),
  };
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
      {(stage === "sourcing" || stage === "evaluasi_negosiasi") && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Perbandingan penawaran</h3>
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
      )}
      {(sections[stage] ?? []).map(([key, title]) => {
        const rows: RecordData[] = list(derived[key]).map((row) => ({
          ...row,
          ringkasan: row.nomor ?? row.nomorRfq ?? row.nomorBast ?? row.namaKapal ?? row.jenisKargo ?? row.kategori ?? row.jenis ?? row.metodeSeleksi ?? row.id,
          pihak: row.vendor?.nama ?? row.penanggungJawabUser?.nama ?? row.nomorKontrak ?? row.vendorId ?? row.dibuatOleh ?? row.diunggahOleh ?? "—",
        }));
        return (
          <div className="space-y-2" key={key}>
            <h3 className="text-sm font-semibold">{title}</h3>
            {rows.length ? (
              <DataTable
                rows={rows}
                rowKey={(row, index) => row.id ?? index}
                columns={[
                  { key: "ringkasan", header: "Record", render: (row) => text(row.ringkasan) },
                  { key: "pihak", header: "Pihak / relasi", render: (row) => text(row.pihak) },
                  { key: "status", header: "Status", render: (row) => text(row.status ?? row.hasil) },
                  { key: "createdAt", header: "Dicatat", render: (row) => date(row.createdAt) },
                  { key: "updatedAt", header: "Diperbarui", render: (row) => date(row.updatedAt ?? row.tanggalKeputusan) },
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
            ) : (
              <EmptyState title={`Belum ada ${title.toLowerCase()}`} description="Record akan tampil setelah dicatat." />
            )}
          </div>
        );
      })}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detail record"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Tutup
          </Button>
        }
      >
        <dl className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
          {Object.entries(selected ?? {}).map(([key, value]) => (
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
