import { getUserRole } from "@/lib/auth/permissions";
import { requireRouteAccess } from "@/lib/auth/require-route-access";
import {
  fetchActasArchivedProjectsCount,
  fetchActasProjects,
} from "@/modules/pm/actas/data/actasRepository";
import { ActasShell } from "@/modules/pm/actas/ui/components/ActasShell";

export const dynamic = "force-dynamic";

export default async function ActasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Corte de servidor ANTES de consultar nada: la versión anterior solo miraba
  // la sesión y ya había pedido los proyectos cuando el guard cliente redirigía.
  const ctx = await requireRouteAccess("pm.actas");

  const [{ projects, error }, { count: archivedCount }] = await Promise.all([
    fetchActasProjects(ctx),
    fetchActasArchivedProjectsCount(ctx),
  ]);

  const hasWriteAccess = getUserRole(ctx, "pm") !== "lector";

  return (
    <ActasShell
      projects={projects}
      archivedCount={archivedCount}
      loadError={error}
      hasWriteAccess={hasWriteAccess}
    >
      {children}
    </ActasShell>
  );
}
