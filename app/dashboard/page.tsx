"use client";

import { Activity, ClipboardList, PackageCheck, RefreshCw, Truck, Wallet } from "lucide-react";
import { useDashboardStats } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/loading/EmptyState";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const numberFormat = new Intl.NumberFormat("id-ID");
const stageLabels: Record<string, string> = {
  perencanaan: "Perencanaan",
  sourcing: "Sourcing / RFQ",
  evaluasi_negosiasi: "Evaluasi & negosiasi",
  approval: "Approval",
  kontrak: "Kontrak",
  delivery: "Delivery",
  settlement: "Settlement",
  selesai: "Selesai",
};
const shipmentLabels: Record<string, string> = { direncanakan: "Direncanakan", dimuat: "Dimuat", dalam_perjalanan: "Dalam perjalanan", tiba: "Tiba", dibongkar: "Dibongkar", diserahkan: "Diserahkan", bermasalah: "Bermasalah" };
const invoiceLabels: Record<string, string> = { draft: "Draft", diverifikasi: "Diverifikasi", diterbitkan: "Diterbitkan", dibayar_sebagian: "Dibayar sebagian", lunas: "Lunas", ditolak: "Ditolak", dibatalkan: "Dibatalkan" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function statusKind(value: string) {
  if (["selesai", "disetujui", "lunas", "diserahkan"].includes(value)) return "ok" as const;
  if (["ditolak", "dibatalkan", "bermasalah"].includes(value)) return "danger" as const;
  if (["diajukan", "dalam_review", "sedang_proses", "menunggu_persetujuan", "dalam_perjalanan"].includes(value)) return "warn" as const;
  return "neutral" as const;
}

function formatPeriod(value: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(new Date(`${value}-01T00:00:00`));
}

function TrendChart({ data }: { data: Array<{ periode: string; jumlah: number }> }) {
  const max = Math.max(1, ...data.map((item) => item.jumlah));
  const points = data.map((item, index) => ({ ...item, x: data.length < 2 ? 50 : 8 + (index / (data.length - 1)) * 84, y: 76 - (item.jumlah / max) * 62 }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <div>
      <div className="relative h-48">
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {[1, 2, 3, 4].map((lineIndex) => (
            <div key={lineIndex} className="border-t border-dashed" />
          ))}
        </div>
        <svg viewBox="0 0 100 84" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" role="img" aria-label="Grafik jumlah pengadaan bulanan">
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className="text-primary" />
          {points.map((point) => (
            <circle key={point.periode} cx={point.x} cy={point.y} r="1.8" className="fill-primary" />
          ))}
        </svg>
      </div>
      <div className="mt-2 grid grid-cols-6 gap-1 text-center text-xs text-muted-foreground">
        {data.map((item) => (
          <span key={item.periode}>{formatPeriod(item.periode)}</span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-6 gap-1 text-center text-xs font-medium">
        {data.map((item) => (
          <span key={item.periode}>{numberFormat.format(item.jumlah)}</span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const statsQuery = useDashboardStats();
  const stats = statsQuery.data?.data;
  const shipmentTotal = stats?.pengiriman.reduce((total, item) => total + item.total, 0) ?? 0;
  const invoiceTotal = stats?.tagihan.reduce((total, item) => total + item.total, 0) ?? 0;
  const invoiceValues =
    stats?.tagihan.reduce<Record<string, number>>((totals, item) => {
      totals[item.mata_uang] = (totals[item.mata_uang] ?? 0) + Number(item.nilai);
      return totals;
    }, {}) ?? {};
  const formatCurrency = (currency: string, value: number) => `${currency} ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
  const invoiceValueLabel =
    Object.entries(invoiceValues)
      .map(([currency, value]) => formatCurrency(currency, value))
      .join(" · ") || "Belum ada nilai";
  const maxStage = Math.max(1, ...(stats?.tahapan.map((item) => item.total) ?? []));

  return (
    <div className="space-y-8 py-1">
      <section className="space-y-4" aria-labelledby="stats-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 id="stats-title" className="flex items-center gap-2 text-xl font-bold">
              <Activity size={20} /> Ringkasan Pengadaan
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Pantau siklus pengadaan dari perencanaan hingga settlement.</p>
          </div>
          <Button variant="outline" size="icon" type="button" aria-label="Muat ulang statistik" onClick={() => void statsQuery.refetch()} disabled={statsQuery.isFetching}>
            <RefreshCw size={18} className={statsQuery.isFetching ? "spin" : ""} />
          </Button>
        </div>
        {statsQuery.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 py-5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-9 w-1/3" />
                  <Skeleton className="h-4 w-4/5" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : statsQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {getApiErrorMessage(statsQuery.error)}
              <Button type="button" variant="link" size="sm" onClick={() => void statsQuery.refetch()}>
                Coba lagi
              </Button>
            </AlertDescription>
          </Alert>
        ) : stats ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total pengadaan" value={stats.pengadaan.total} detail={`${numberFormat.format(stats.pengadaan.bulan_ini)} dibuat bulan ini`} icon={ClipboardList} />
            <SummaryCard label="Menunggu approval" value={stats.approval_pending} detail={`${numberFormat.format(stats.pengadaan.dalam_review)} pengadaan dalam review`} icon={Activity} />
            <SummaryCard label="Pengiriman" value={shipmentTotal} detail="Total kargo tercatat" icon={Truck} />
            <SummaryCard label="Tagihan" value={invoiceTotal} detail={`Nilai tercatat: ${invoiceValueLabel}`} icon={Wallet} />
          </div>
        ) : null}
      </section>

      {stats ? (
        <>
          <section className="grid gap-4 xl:grid-cols-5" aria-label="Visualisasi siklus pengadaan">
            <Card className="xl:col-span-3">
              <CardHeader>
                <CardTitle>Siklus transaksi</CardTitle>
                <CardDescription>Jumlah record per tahap lifecycle procurement.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stats.tahapan.map((stage) => (
                  <div key={stage.tahap} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{stageLabels[stage.tahap] ?? stage.tahap}</span>
                      <span className="text-muted-foreground">
                        {numberFormat.format(stage.total)} total · {numberFormat.format(stage.aktif)} aktif · {numberFormat.format(stage.selesai)} selesai
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(stage.total / maxStage) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Tren pengadaan</CardTitle>
                <CardDescription>Enam bulan terakhir berdasarkan tanggal pencatatan.</CardDescription>
              </CardHeader>
              <CardContent>{stats.trend_bulanan.length ? <TrendChart data={stats.trend_bulanan} /> : <EmptyState title="Belum ada data tren" />}</CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-2" aria-label="Status delivery dan settlement">
            <BreakdownCard
              title="Delivery & kargo"
              description="Status pengiriman kargo pada seluruh transaksi."
              icon={Truck}
              items={stats.pengiriman.map((item) => ({ label: shipmentLabels[item.status] ?? item.status, status: item.status, total: item.total }))}
            />
            <BreakdownCard
              title="Settlement & tagihan"
              description={`Nilai tagihan tercatat: ${invoiceValueLabel}.`}
              icon={Wallet}
              items={stats.tagihan.map((item) => ({ label: `${invoiceLabels[item.status] ?? item.status} · ${item.mata_uang}`, status: item.status, total: item.total }))}
            />
          </section>

          <section className="space-y-4" aria-labelledby="recent-title">
            <div>
              <h2 id="recent-title" className="flex items-center gap-2 text-xl font-bold">
                <PackageCheck size={20} /> Pengadaan Terbaru
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">5 pengadaan terakhir tercatat</p>
            </div>
            {stats.recent_pengadaan.length ? (
              <Card>
                <div className="overflow-x-auto">
                  <Table className="min-w-[42rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nomor</TableHead>
                        <TableHead>Judul</TableHead>
                        <TableHead>Pemohon</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Tanggal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recent_pengadaan.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.nomorSurat || "—"}</TableCell>
                          <TableCell className="font-medium">{item.judul}</TableCell>
                          <TableCell>{item.diajukanOlehUser?.nama || "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={statusKind(item.status)}>{item.status.replaceAll("_", " ")}</StatusBadge>
                          </TableCell>
                          <TableCell>{formatDate(item.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            ) : (
              <EmptyState title="Belum ada pengadaan" />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: number; detail: string; icon: typeof ClipboardList }) {
  return (
    <Card>
      <CardContent className="relative py-5">
        <Icon className="absolute right-5 top-5 size-5 text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{label}</p>
        <strong className="mt-2 block text-3xl tracking-tight">{numberFormat.format(value)}</strong>
        <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, description, icon: Icon, items }: { title: string; description: string; icon: typeof Truck; items: Array<{ label: string; status: string; total: number }> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon size={19} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.status} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
              <StatusBadge status={statusKind(item.status)}>{item.label}</StatusBadge>
              <span className="font-semibold tabular-nums">{numberFormat.format(item.total)}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data.</p>
        )}
      </CardContent>
    </Card>
  );
}
