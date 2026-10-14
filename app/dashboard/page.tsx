"use client";

import { useSearchParams } from "next/navigation";
import { Activity, ClipboardList, PackageCheck, RefreshCw, Users } from "lucide-react";
import AppCard from "@/components/AppCard";
import { apps } from "@/lib/apps";
import { useDashboardStats } from "@/lib/api/hooks";
import { getApiErrorMessage } from "@/lib/api/errors";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  const list = q ? apps.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(q.toLowerCase())) : apps;
  const statsQuery = useDashboardStats();
  const stats = statsQuery.data?.data;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">
            Selamat Datang,
            <br />
            di LEMIGAS Super Apps
          </h1>
          <p>Akses semua aplikasi Anda dalam satu pintu, lebih mudah, lebih cepat dan terintegrasi.</p>
        </div>
      </section>

      <section className="section" aria-labelledby="stats-title">
        <div className="section-head">
          <div>
            <h2 id="stats-title">
              <Activity size={22} aria-hidden="true" /> Ringkasan Pengadaan
            </h2>
            <p>Statistik terkini dari sistem pengadaan</p>
          </div>
          <button className="icon-btn" type="button" aria-label="Muat ulang statistik" onClick={() => void statsQuery.refetch()} disabled={statsQuery.isFetching}>
            <RefreshCw size={18} className={statsQuery.isFetching ? "spin" : ""} />
          </button>
        </div>
        {statsQuery.isPending ? (
          <div className="dashboard-state" role="status">
            Memuat statistik…
          </div>
        ) : statsQuery.isError ? (
          <div className="dashboard-error" role="alert">
            {getApiErrorMessage(statsQuery.error)}
            <button type="button" onClick={() => void statsQuery.refetch()}>
              Coba lagi
            </button>
          </div>
        ) : (
          stats && (
            <div className="stats-grid">
              <article className="stat-card">
                <span>Total pengadaan</span>
                <strong>{stats.pengadaan.total}</strong>
                <small>{stats.pengadaan.bulan_ini} diajukan bulan ini</small>
                <ClipboardList aria-hidden="true" />
              </article>
              <article className="stat-card">
                <span>Dalam review</span>
                <strong>{stats.pengadaan.dalam_review}</strong>
                <small>{stats.approval_pending} approval menunggu</small>
                <Activity aria-hidden="true" />
              </article>
              <article className="stat-card">
                <span>Pengadaan selesai</span>
                <strong>{stats.pengadaan.selesai}</strong>
                <small>{stats.pengadaan.disetujui} disetujui</small>
                <PackageCheck aria-hidden="true" />
              </article>
              <article className="stat-card">
                <span>Vendor aktif</span>
                <strong>{stats.master.vendor_aktif}</strong>
                <small>{stats.master.total_barang} item barang</small>
                <Users aria-hidden="true" />
              </article>
            </div>
          )
        )}
      </section>

      {stats && (
        <section className="section" aria-labelledby="recent-title">
          <div className="section-head">
            <div>
              <h2 id="recent-title">
                <ClipboardList size={22} aria-hidden="true" /> Pengadaan Terbaru
              </h2>
              <p>5 pengadaan terakhir tercatat</p>
            </div>
          </div>
          {stats.recent_pengadaan.length ? (
            <div className="recent-table-wrap">
              <table className="recent-table">
                <thead>
                  <tr>
                    <th>Nomor</th>
                    <th>Judul</th>
                    <th>Pemohon</th>
                    <th>Status</th>
                    <th>Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_pengadaan.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nomorSurat || "—"}</td>
                      <td>{item.judul}</td>
                      <td>{item.diajukanOlehUser?.nama || "—"}</td>
                      <td>
                        <span className={`status-pill status-${item.status}`}>{item.status.replaceAll("_", " ")}</span>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">Belum ada pengadaan.</p>
          )}
        </section>
      )}

      <section className="section" aria-labelledby="apps-title">
        <div className="section-head">
          <div>
            <h2 id="apps-title">Aplikasi Anda</h2>
            <p>Pilih aplikasi yang ingin Anda akses</p>
          </div>
        </div>
        {list.length > 0 ? (
          <div className="app-grid">
            {list.map((a) => (
              <AppCard key={a.id} app={a} />
            ))}
          </div>
        ) : (
          <p className="empty">Tidak ada aplikasi yang cocok dengan “{q}”. Coba kata kunci lain atau hapus pencarian.</p>
        )}
      </section>
    </>
  );
}
