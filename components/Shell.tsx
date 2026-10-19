"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import { clearSession, type User } from "@/lib/auth";
import { useCurrentUser } from "@/lib/api/hooks";
import { browserApi } from "@/lib/api/browser-client";

export default function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false); // desktop
  const [drawerOpen, setDrawerOpen] = useState(false); // mobile

  // Buang sesi lokal hanya jika server menolak token sebagai tidak sah/kedaluwarsa.
  useEffect(() => {
    const status = (currentUser.error as (Error & { status?: number }) | null)?.status;
    if (!currentUser.isError || status !== 401) return;
    clearSession();
    browserApi.setSecurityData(null);
    router.replace("/login");
  }, [currentUser.isError, currentUser.error, router]);

  // Tutup drawer saat pindah halaman atau menekan Esc.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleMenu = useCallback(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((c) => !c);
    else setDrawerOpen((o) => !o);
  }, []);

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Lewati ke konten utama
      </a>
      <Topbar user={user} onMenu={toggleMenu} />
      <div className="layout" data-collapsed={collapsed}>
        <Sidebar collapsed={collapsed} open={drawerOpen} onToggle={toggleMenu} />
        {drawerOpen && <div className="scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        <div className="main-col">
          <main id="main" className="main">
            <div className="page-surface">{children}</div>
          </main>
          <footer className="footer">© 2026 LEMIGAS · Kementerian ESDM</footer>
        </div>
      </div>
    </div>
  );
}
