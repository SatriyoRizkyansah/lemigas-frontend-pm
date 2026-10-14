"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Archive, Bell, Boxes, ClipboardList, FileText, FolderOpen, Gauge, Package, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck, Store, Users } from "lucide-react";
import Skyline from "./Skyline";
import { userFromIdentity, SESSION_COOKIE } from "@/lib/auth";
import { Button } from "@/components/ui/legacy-button";
import { useEffect, useState } from "react";

const allSections = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Gauge, exact: true },
      { href: "/dashboard/notifikasi", label: "Notifikasi", icon: Bell },
    ],
  },
  {
    title: "Data Master",
    items: [
      { href: "/dashboard/vendor", label: "Vendor", icon: Store },
      { href: "/dashboard/kategori", label: "Kategori", icon: Archive },
      { href: "/dashboard/barang", label: "Barang", icon: Boxes },
    ],
  },
  {
    title: "Pengadaan",
    items: [
      { href: "/dashboard/rencana-transaksi", label: "Rencana Transaksi", icon: ClipboardList },
      { href: "/dashboard/pengadaan", label: "Pengadaan", icon: Package },
      { href: "/dashboard/approval", label: "Approval", icon: ShieldCheck },
      { href: "/dashboard/dokumen", label: "Dokumen", icon: FolderOpen },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/dashboard/pengguna", label: "Pengguna", icon: Users },
      { href: "/dashboard/audit-log", label: "Audit Log", icon: Activity },
    ],
  },
];

function allowedSections(role: string) {
  const normalized = role.toLowerCase();
  if (normalized.includes("admin")) return allSections;
  if (normalized.includes("operator")) return allSections.filter((section) => section.title !== "Sistem");
  if (normalized.includes("verifikator")) return [allSections[0], { ...allSections[2], items: allSections[2].items.filter((item) => ["Rencana Transaksi", "Pengadaan", "Approval"].includes(item.label)) }];
  if (normalized.includes("pimpinan"))
    return [
      allSections[0],
      { ...allSections[2], items: allSections[2].items.filter((item) => ["Rencana Transaksi", "Approval"].includes(item.label)) },
      { ...allSections[3], items: allSections[3].items.filter((item) => item.label === "Audit Log") },
    ];
  return [allSections[0], { ...allSections[2], items: allSections[2].items.filter((item) => ["Rencana Transaksi", "Pengadaan", "Dokumen"].includes(item.label)) }];
}

type Props = { collapsed: boolean; open: boolean; onToggle: () => void };

export default function Sidebar({ collapsed, open, onToggle }: Props) {
  const pathname = usePathname() ?? "";
  const [role, setRole] = useState("user");
  useEffect(() => {
    const value = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    setRole(userFromIdentity(value).role);
  }, []);
  const sections = allowedSections(role);

  return (
    <aside className="sidebar-slot" data-open={open} data-collapsed={collapsed}>
      <nav className="sidebar" aria-label="Navigasi pengadaan">
        <div className="sidebar-menu">
          {sections.map((section) => (
            <section key={section.title}>
              <p className="sidebar-title">{section.title}</p>
              <ul className="nav">
                {section.items.map(({ href, label, icon: Icon, exact }) => {
                  const active = exact ? pathname === href : pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link href={href} className="nav-link" aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>
                        <Icon size={20} aria-hidden="true" />
                        <span className="nav-label">{label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="sidebar-foot">
          {/* <Skyline className="sidebar-skyline" /> */}
          {/* <p className="sidebar-tagline">
            Energi untuk
            <br />
            Ketahanan Negeri
          </p> */}
          <Button type="button" variant="dark" size="sm" className="collapse-btn" onClick={onToggle}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span className="nav-label only-desktop">{collapsed ? "Perbesar" : "Perkecil"}</span>
            <span className="only-mobile">Tutup</span>
          </Button>
        </div>
      </nav>
    </aside>
  );
}
