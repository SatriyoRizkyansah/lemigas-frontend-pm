"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronDown, LayoutGrid, LogOut, Menu, Search, User as UserIcon } from "lucide-react";
import Logo from "./Logo";
import { clearSession, type User } from "@/lib/auth";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { dateText, entityText, unwrapEntityList } from "@/components/procurement/EntityListPage";

export default function Topbar({ user, onMenu }: { user: User; onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const notifications = use_query<any[], Error, Record<string, never>>({
    tag: "notifikasi",
    method: "notifikasiGetControllerFindAll",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return unwrapEntityList(await apiData(browserApi.notifikasi.notifikasiGetControllerFindAll({ limit: 5, page: 1 }, { format: "json" }) as Promise<{ data: unknown }>));
    },
  });
  const markAllRead = use_mutation<unknown, Error, void>({
    tag: "notifikasi",
    method: "notifikasiPutControllerMarkAllAsRead",
    invalidateKeys: [apiQueryKeys.resource("notifikasi")],
    mutationFn: async () => {
      setBrowserToken();
      return apiData(browserApi.notifikasi.notifikasiPutControllerMarkAllAsRead({ format: "json" }) as Promise<{ data: unknown }>);
    },
  });

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

  function logout() {
    clearSession();
    router.replace("/login");
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
            className={`icon-btn plain${notifications.data?.some((item) => !item.dibaca) ? " has-dot" : ""}`}
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
                <button type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending || !notifications.data?.some((item) => !item.dibaca)}>
                  <CheckCheck size={15} /> Tandai semua dibaca
                </button>
              </div>
              {notifications.isPending ? (
                <p className="notification-empty">Memuat notifikasi…</p>
              ) : notifications.isError ? (
                <p className="notification-empty">Notifikasi gagal dimuat.</p>
              ) : notifications.data?.length ? (
                <ul className="notification-list">
                  {notifications.data.slice(0, 5).map((item) => (
                    <li key={item.id} className={item.dibaca ? "" : "unread"}>
                      <strong>{entityText(item.judul ?? item.title ?? item.pesan)}</strong>
                      <span>{entityText(item.pesan ?? item.message ?? item.deskripsi)}</span>
                      <time>{dateText(item.createdAt)}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="notification-empty">Belum ada notifikasi.</p>
              )}
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
              <button type="button" role="menuitem" onClick={logout}>
                <LogOut size={18} /> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
