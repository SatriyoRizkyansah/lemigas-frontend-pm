"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { browserApi } from "@/lib/api/browser-client";
import { Bell, CheckCheck, ChevronDown, LayoutGrid, LogOut, Menu, Search, User as UserIcon } from "lucide-react";
import Logo from "./Logo";
import { clearSession, type User } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { dateText } from "@/components/procurement/EntityListPage";
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/app/dashboard/notifikasi/notifications";

export default function Topbar({ user, onMenu }: { user: User; onMenu: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const logoutLock = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notifications = useNotifications(1, 5);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const readPending = markRead.isPending || markAllRead.isPending;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) setNotificationsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/dashboard?q=${encodeURIComponent(term)}` : "/dashboard");
  }

  async function logout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setLoggingOut(true);
    try {
      await queryClient.cancelQueries();
    } finally {
      queryClient.clear();
      browserApi.setSecurityData(null);
      clearSession();
      router.replace("/login");
    }
  }

  return (
    <header className="topbar">
      <button type="button" className="icon-btn" onClick={onMenu} aria-label="Buka atau tutup menu">
        <Menu size={20} />
      </button>

      <Link href="/dashboard" className="topbar-brand" aria-label="LEMIGAS Super Apps, ke beranda">
        <Logo size={40} />
        <span>
          <strong>LEMIGAS</strong>
          <small>Super Apps</small>
        </span>
      </Link>

      <form className="search" role="search" onSubmit={onSearch}>
        <Search size={18} aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari aplikasi, menu, atau fitur…" aria-label="Cari aplikasi, menu, atau fitur" />
      </form>

      <div className="topbar-actions">
        <div className="notification-menu" ref={notificationsRef}>
          <button
            type="button"
            className={`icon-btn plain${notifications.data?.unread_count ? " has-dot" : ""}`}
            aria-label="Notifikasi"
            aria-haspopup="dialog"
            aria-expanded={notificationsOpen}
            onClick={() => setNotificationsOpen((open) => !open)}
          >
            <Bell size={20} />
          </button>
          {notificationsOpen ? (
            <div className="dropdown notification-dropdown" role="dialog" aria-label="Notifikasi terbaru">
              <div className="dropdown-head notification-head">
                <strong>Notifikasi</strong>
                <Button
                  variant="ghost"
                  size="xs"
                  type="button"
                  onClick={() => {
                    markRead.reset();
                    markAllRead.mutate();
                  }}
                  disabled={readPending || !notifications.data?.unread_count}
                >
                  <CheckCheck size={15} /> Tandai semua dibaca
                </Button>
              </div>
              {notifications.isPending ? (
                <p className="notification-empty">Memuat notifikasi…</p>
              ) : notifications.isError ? (
                <p className="notification-empty">Notifikasi gagal dimuat.</p>
              ) : notifications.data?.data.length ? (
                <ul className="notification-list">
                  {notifications.data.data.slice(0, 5).map((item) => (
                    <li key={item.id} className={item.sudahDibaca ? "" : "unread"}>
                      <strong>{item.pengadaan?.judul ?? "Notifikasi"}</strong>
                      <span>{item.pesan}</span>
                      <time dateTime={item.tanggalKirim}>{dateText(item.tanggalKirim)}</time>
                      {!item.sudahDibaca ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          type="button"
                          disabled={readPending}
                          aria-label={`Tandai dibaca: ${item.pesan}`}
                          onClick={() => {
                            markAllRead.reset();
                            markRead.mutate(item.id);
                          }}
                        >
                          {markRead.isPending && markRead.variables === item.id ? "Menandai…" : "Tandai dibaca"}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="notification-empty">Belum ada notifikasi.</p>
              )}
              {markRead.isError || markAllRead.isError ? (
                <p className="notification-empty" role="alert">
                  Gagal menandai notifikasi. Silakan coba lagi.
                </p>
              ) : null}
              <Link href="/dashboard/notifikasi" onClick={() => setNotificationsOpen(false)}>
                Lihat semua notifikasi
              </Link>
            </div>
          ) : null}
        </div>
        <Link href="/dashboard/aplikasi" className="icon-btn plain hide-sm" aria-label="Semua aplikasi">
          <LayoutGrid size={20} />
        </Link>

        <div className="user-menu" ref={menuRef}>
          <button type="button" className="user-btn" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
            <span className="avatar">{user.initials}</span>
            <span className="user-name">{user.name}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>

          {menu && (
            <div className="dropdown" role="menu">
              <div className="dropdown-head">
                <strong>{user.name}</strong>
                <span>{user.email || user.role}</span>
              </div>
              <Link href="/dashboard/profil" role="menuitem" onClick={() => setMenu(false)}>
                <UserIcon size={18} /> Profil
              </Link>
              <button type="button" role="menuitem" disabled={loggingOut} onClick={() => void logout()}>
                <LogOut size={18} /> {loggingOut ? "Keluar…" : "Keluar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
