"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, Home, LayoutGrid, PanelLeftClose, PanelLeftOpen, User } from "lucide-react";
import Skyline from "./Skyline";

const nav = [
  { href: "/dashboard", label: "Beranda", icon: Home, exact: true },
  { href: "/dashboard/aplikasi", label: "Aplikasi", icon: LayoutGrid },
  { href: "/dashboard/profil", label: "Profil", icon: User },
  { href: "/dashboard/bantuan", label: "Bantuan", icon: HelpCircle },
];

type Props = { collapsed: boolean; open: boolean; onToggle: () => void };

export default function Sidebar({ collapsed, open, onToggle }: Props) {
  const pathname = usePathname();

  return (
    <aside className="sidebar-slot" data-open={open} data-collapsed={collapsed}>
      <nav className="sidebar" aria-label="Navigasi portal">
        <p className="sidebar-title">PORTAL</p>

        <ul className="nav">
          {nav.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="nav-link"
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span className="nav-label">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-foot">
          <Skyline className="sidebar-skyline" />
          <p className="sidebar-tagline">
            Energi untuk
            <br />
            Ketahanan Negeri
          </p>
          <button type="button" className="collapse-btn" onClick={onToggle}>
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            <span className="nav-label only-desktop">{collapsed ? "Perbesar" : "Perkecil"}</span>
            <span className="only-mobile">Tutup</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
