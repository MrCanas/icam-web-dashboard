import type { ActasProjectListItem } from "@/modules/pm/actas/types";

import { ActasCollapsibleLayout } from "./ActasCollapsibleLayout";

interface ActasShellProps {
  projects: ActasProjectListItem[];
  archivedCount: number;
  loadError: string | null;
  hasWriteAccess?: boolean;
  children: React.ReactNode;
}

export function ActasShell({
  projects,
  archivedCount,
  loadError,
  hasWriteAccess = true,
  children,
}: ActasShellProps) {
  return (
    <div className="flex flex-col gap-4 min-h-0">
      <header className="bg-card rounded-lg border border-subtle/50 p-4 shrink-0">
        <h1 className="text-xl font-semibold text-text-primary">Actas</h1>
        <p className="mt-1 text-sm text-text-muted">
          Seguimiento operativo por proyecto
        </p>
      </header>

      {loadError ? (
        <section className="bg-card rounded-lg border border-red-200 p-4 text-red-700 text-sm">
          No se pudo cargar la lista de proyectos: {loadError}
        </section>
      ) : null}

      <ActasCollapsibleLayout
        projects={projects}
        archivedCount={archivedCount}
        hasWriteAccess={hasWriteAccess}
      >
        {children}
      </ActasCollapsibleLayout>
    </div>
  );
}
