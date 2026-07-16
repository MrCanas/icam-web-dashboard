"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { firstAccessiblePath, userCanAccessPath } from "@/lib/auth/zone-access";

interface DashboardZoneGuardProps {
  children: ReactNode;
}

export function DashboardZoneGuard({ children }: DashboardZoneGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (loading) return;

    // Sesión inválida en servidor pese a tener cookie (p. ej. cuenta
    // desactivada): sin esto la página se quedaría en blanco para siempre.
    if (!user) {
      router.replace("/login");
      return;
    }

    if (userCanAccessPath(user, pathname)) return;

    const fallback = firstAccessiblePath(user);
    if (fallback) {
      router.replace(fallback);
      return;
    }

    router.replace("/sin-acceso");
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-text-muted">
        Cargando…
      </div>
    );
  }

  // Sin `user` el efecto ya está redirigiendo a /login.
  if (!user || !userCanAccessPath(user, pathname)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-text-muted">
        Redirigiendo…
      </div>
    );
  }

  return <>{children}</>;
}
