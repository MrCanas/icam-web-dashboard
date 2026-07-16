"use client";

import { DashboardNav } from "@/components/layout/DashboardNav";
import { HeaderUserMenu } from "@/components/layout/HeaderUserMenu";
import { NotificationBell } from "@/components/layout/NotificationBell";
import Image from "next/image";
import { useEffect, useState } from "react";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="bg-icam-900 shrink-0 flex flex-col border-b border-white/10">
        <div className="h-14 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <button
              type="button"
              className="lg:hidden flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/95 hover:bg-white/10 text-xl leading-none"
              aria-expanded={menuOpen}
              aria-controls="dashboard-mobile-nav"
              aria-label="Abrir menú de navegación"
              onClick={() => setMenuOpen(true)}
            >
              ☰
            </button>
            <div className="h-7 sm:h-8 bg-icam-900 flex items-center min-w-0 flex-1 justify-center lg:justify-start">
              <Image
                src="/logo-icam.png"
                alt="ICAM Asset Manager"
                width={220}
                height={32}
                className="h-7 sm:h-8 w-auto max-w-[120px] sm:max-w-[200px] lg:max-w-[220px] object-contain object-left mix-blend-lighten"
                priority
              />
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <NotificationBell />
            <HeaderUserMenu variant="desktop" />
          </div>
        </div>

        <div className="hidden lg:block px-3 sm:px-6 lg:px-8 pb-3 pt-1">
          <DashboardNav layout="horizontal" />
        </div>
      </header>

      {menuOpen ? (
        <div className="lg:hidden fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="dashboard-mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navegación"
            className="absolute top-0 right-0 h-full w-[min(100%,20rem)] bg-icam-900 shadow-2xl flex flex-col border-l border-white/10"
          >
            <div className="flex items-center justify-between h-14 px-3 border-b border-white/10 shrink-0">
              <span className="text-white/80 text-sm font-medium">Menú</span>
              <button
                type="button"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-white/80 hover:bg-white/10 text-lg"
                aria-label="Cerrar"
                onClick={() => setMenuOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <DashboardNav layout="vertical" onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="p-3 border-t border-white/10 shrink-0 space-y-1">
              <div className="px-2 pb-2 flex justify-end">
                <NotificationBell />
              </div>
              <HeaderUserMenu
                variant="drawer"
                onNavigate={() => setMenuOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
