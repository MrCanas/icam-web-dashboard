"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { initialsForUser } from "@/lib/user-initials";

interface HeaderUserMenuProps {
  /** `drawer` se renderiza en plano: un popover dentro del slide-over es un lío de foco. */
  variant: "desktop" | "drawer";
  onNavigate?: () => void;
}

export function HeaderUserMenu({ variant, onNavigate }: HeaderUserMenuProps) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  const isDrawer = variant === "drawer";

  const itemClass = isDrawer
    ? "block w-full min-h-11 text-left text-sm text-white/70 hover:text-white py-2 px-2 rounded-md hover:bg-white/5 transition"
    : "block w-full min-h-11 px-3 py-2 text-left text-sm text-text-body hover:bg-page transition";

  const menuItems = (
    <>
      <Link
        href="/dashboard/perfil"
        role="menuitem"
        className={itemClass}
        onClick={() => {
          setOpen(false);
          onNavigate?.();
        }}
      >
        Mi perfil
      </Link>
      {user.isPlatformAdmin ? (
        <Link
          href="/dashboard/admin/usuarios"
          role="menuitem"
          className={itemClass}
          onClick={() => {
            setOpen(false);
            onNavigate?.();
          }}
        >
          Administrar usuarios
        </Link>
      ) : null}
      <form action="/api/auth/logout" method="post">
        <button type="submit" role="menuitem" className={itemClass}>
          Cerrar sesión
        </button>
      </form>
    </>
  );

  if (isDrawer) {
    return (
      <div className="space-y-1">
        <div className="px-2 pb-1">
          <p className="truncate text-sm font-medium text-white/90">
            {user.name}
          </p>
          <p className="truncate text-xs text-white/50">{user.email}</p>
        </div>
        {menuItems}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white transition hover:bg-white/20"
        onClick={() => setOpen((prev) => !prev)}
      >
        {initialsForUser(user.name, user.email)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-subtle/50 bg-card py-1 shadow-lg"
        >
          <div className="border-b border-subtle/40 px-3 pb-2 pt-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {user.name}
            </p>
            <p className="truncate text-xs text-text-muted">{user.email}</p>
          </div>
          {menuItems}
        </div>
      ) : null}
    </div>
  );
}
