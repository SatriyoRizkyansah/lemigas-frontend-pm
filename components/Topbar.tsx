"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LayoutGrid, LogOut, Menu, Search, User as UserIcon } from "lucide-react";
import Logo from "./Logo";
import { clearSession, type User } from "@/lib/auth";

export default function Topbar({ user, onMenu }: { user: User; onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
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
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari aplikasi, menu, atau fitur…"
          aria-label="Cari aplikasi, menu, atau fitur"
        />
      </form>

      <div className="topbar-actions">
        <button type="button" className="icon-btn plain has-dot" aria-label="Notifikasi">
          <Bell size={20} />
        </button>
        <Link href="/dashboard/aplikasi" className="icon-btn plain hide-sm" aria-label="Semua aplikasi">
          <LayoutGrid size={20} />
        </Link>

        <div className="user-menu" ref={menuRef}>
          <button
            type="button"
            className="user-btn"
            onClick={() => setMenu((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={menu}
          >
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
