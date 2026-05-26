import type { ActasProjectListItem } from "@/modules/pm/actas/types";

import { ActasProjectSidebar } from "./ActasProjectSidebar";

interface ActasShellProps {
  projects: ActasProjectListItem[];
  loadError: string | null;
  children: React.ReactNode;
}

export function ActasShell({ projects, loadError, children }: ActasShellProps) {
  return (
    <div className="flex flex-col gap-4 min-h-0">
      <header className="bg-card rounded-lg border border-subtle/50 p-4 shrink-0">
        <h1 className="text-xl font-semibold text-text-primary">PM — Actas</h1>
        <p className="mt-1 text-sm text-text-muted">
          Seguimiento operativo por proyecto
        </p>
      </header>

      {loadError ? (
        <section className="bg-card rounded-lg border border-red-200 p-4 text-red-700 text-sm">
          No se pudo cargar la lista de proyectos: {loadError}
        </section>
      ) : null}

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 min-w-0">
        <ActasProjectSidebar projects={projects} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
