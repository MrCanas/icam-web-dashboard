"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  actasHubPath,
  actasProjectPath,
} from "@/modules/pm/actas/logic/actas-paths";
import type { ActasArchivedProjectListItem } from "@/modules/pm/actas/types";

import { ActasArchivedProjectRow } from "../components/ActasArchivedProjectRow";

interface ActasArchivedProjectsPageProps {
  projects: ActasArchivedProjectListItem[];
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function ActasArchivedProjectsPage({
  projects,
}: ActasArchivedProjectsPageProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return projects;
    return projects.filter((p) => {
      const haystack = `${p.code} ${p.name}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [projects, search]);

  const handleRestored = (projectCode: string) => {
    setToast(`Proyecto ${projectCode} restaurado`);
    router.push(actasProjectPath(projectCode));
    router.refresh();
    window.setTimeout(() => setToast(null), 5000);
  };

  return (
    <>
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-icam-900/20 bg-card px-4 py-2.5 text-sm font-medium text-icam-900 shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Proyectos archivados
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {projects.length} proyecto{projects.length === 1 ? "" : "s"}{" "}
              oculto{projects.length === 1 ? "" : "s"} del listado principal.
            </p>
          </div>
          <Link
            href={actasHubPath()}
            className="text-sm font-medium text-icam-900 hover:underline"
          >
            Volver a proyectos activos
          </Link>
        </div>

        <label htmlFor="actas-archived-search" className="sr-only">
          Buscar proyecto archivado
        </label>
        <input
          id="actas-archived-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o nombre…"
          className="w-full max-w-md min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30"
          autoComplete="off"
        />

        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-subtle/60 bg-page px-4 py-8 text-center text-sm text-text-muted">
            {projects.length === 0
              ? "No hay proyectos archivados."
              : "Ningún proyecto coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((project) => (
              <li key={project.id}>
                <ActasArchivedProjectRow
                  project={project}
                  onRestored={handleRestored}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
