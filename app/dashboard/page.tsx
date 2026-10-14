"use client";

import { useSearchParams } from "next/navigation";
import { Activity, ClipboardList, PackageCheck, RefreshCw, Users } from "lucide-react";
import AppCard from "@/components/AppCard";
import { apps } from "@/lib/apps";
import { useDashboardStats } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/loading/EmptyState";
import { Button } from "@/components/ui/Button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

function statusKind(value: string) {
  if (["selesai", "disetujui"].includes(value)) return "ok" as const;
  if (["ditolak", "dibatalkan"].includes(value)) return "danger" as const;
  if (["diajukan", "dalam_review", "sedang_proses"].includes(value)) return "warn" as const;
  return "neutral" as const;
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const q = (searchParams?.get("q") ?? "").trim();
  const list = q ? apps.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(q.toLowerCase())) : apps;
  const statsQuery = useDashboardStats();
  const stats = statsQuery.data?.data;
  const statCards = stats
    ? [
        { label: "Total pengadaan", value: stats.pengadaan.total, detail: `${stats.pengadaan.bulan_ini} diajukan bulan ini`, icon: ClipboardList },
        { label: "Dalam review", value: stats.pengadaan.dalam_review, detail: `${stats.approval_pending} approval menunggu`, icon: Activity },
        { label: "Pengadaan selesai", value: stats.pengadaan.selesai, detail: `${stats.pengadaan.disetujui} disetujui`, icon: PackageCheck },
        { label: "Vendor aktif", value: stats.master.vendor_aktif, detail: `${stats.master.total_barang} item barang`, icon: Users },
      ]
    : [];

  return (
    <div className="space-y-8 py-1">
      <section className="overflow-hidden rounded-2xl bg-[linear-gradient(115deg,#0e2347_0%,#173d75_50%,#e6a800_100%)] px-6 py-10 text-white shadow-sm sm:px-10" aria-labelledby="hero-title">
        <h1 id="hero-title" className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Selamat Datang,
          <br />
          di LEMIGAS Super Apps
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/90 sm:text-base">Akses semua aplikasi Anda dalam satu pintu, lebih mudah, lebih cepat dan terintegrasi.</p>
      </section>

      <section className="space-y-4" aria-labelledby="stats-title">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="stats-title" className="flex items-center gap-2 text-xl font-bold">
              <Activity size={20} /> Ringkasan Pengadaan
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Statistik terkini dari sistem pengadaan</p>
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
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map(({ label, value, detail, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="relative py-5">
                  <Icon className="absolute right-5 top-5 size-5 text-primary" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <strong className="mt-2 block text-3xl tracking-tight">{value}</strong>
                  <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {stats ? (
        <section className="space-y-4" aria-labelledby="recent-title">
          <div>
            <h2 id="recent-title" className="flex items-center gap-2 text-xl font-bold">
              <ClipboardList size={20} /> Pengadaan Terbaru
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
      ) : null}

      <section className="space-y-4" aria-labelledby="apps-title">
        <div>
          <h2 id="apps-title" className="text-xl font-bold">
            Aplikasi Anda
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Pilih aplikasi yang ingin Anda akses</p>
        </div>
        {list.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((a) => (
              <AppCard key={a.id} app={a} />
            ))}
          </div>
        ) : (
          <EmptyState title="Tidak ada aplikasi yang cocok" description={`Tidak ada aplikasi yang cocok dengan “${q}”. Coba kata kunci lain atau hapus pencarian.`} />
        )}
      </section>
    </div>
  );
}
