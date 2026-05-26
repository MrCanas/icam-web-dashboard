"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { actasHubPath, actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

import { ActasProjectPhaseBadge } from "./ActasProjectPhaseBadge";

interface ActasProjectSidebarProps {
  projects: ActasProjectListItem[];
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function projectMatchesQuery(project: ActasProjectListItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${project.code} ${project.name}`.toLowerCase();
  return haystack.includes(query);
}

export function ActasProjectSidebar({ projects }: ActasProjectSidebarProps) {
  const pathname = usePathname();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return projects.filter((p) => projectMatchesQuery(p, q));
  }, [projects, search]);

  if (!projects.length) {
    return (
      <aside className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-subtle/50 bg-card p-4 lg:w-72">
        <p className="text-sm font-medium text-text-primary">Proyectos</p>
        <div className="rounded-md border border-dashed border-subtle/60 bg-page p-4 text-center">
          <p className="text-sm text-text-muted">Crea tu primer proyecto</p>
          <button
            type="button"
            disabled
            className="mt-3 min-h-10 rounded-md border border-icam-gold/50 bg-icam-gold/10 px-4 text-sm font-medium text-icam-900 opacity-60 cursor-not-allowed"
            title="Próximamente"
          >
            Nuevo proyecto
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-subtle/50 bg-card lg:w-72 lg:max-h-[calc(100vh-14rem)]">
      <div className="border-b border-subtle/40 p-3">
        <label htmlFor="actas-project-search" className="sr-only">
          Buscar proyecto
        </label>
        <input
          id="actas-project-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o nombre…"
          className="w-full min-h-10 rounded-md border border-subtle/60 bg-page px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-icam-900 focus:outline-none focus:ring-1 focus:ring-icam-900/30"
          autoComplete="off"
        />
      </div>

      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 min-h-0"
        aria-label="Proyectos Actas"
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-text-muted">
            Ningún proyecto coincide con la búsqueda.
          </p>
        ) : (
          filtered.map((project) => {
            const href = actasProjectPath(project.code);
            const active =
              pathname === href ||
              pathname.startsWith(`${href}/`);
            return (
              <Link
                key={project.id}
                href={href}
                className={`flex flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-icam-900/40 bg-icam-900/5 shadow-sm"
                    : "border-transparent hover:border-subtle/50 hover:bg-page"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-icam-900">
                    {project.code}
                  </span>
                  <ActasProjectPhaseBadge phase={project.phase} />
                </div>
                <span className="text-sm leading-snug text-text-primary line-clamp-2">
                  {project.name}
                </span>
              </Link>
            );
          })
        )}
      </nav>

      <div className="border-t border-subtle/40 p-2">
        <Link
          href={actasHubPath()}
          className={`block rounded-md px-2 py-2 text-xs text-text-muted hover:bg-page hover:text-text-primary ${
            pathname === actasHubPath() ? "font-medium text-icam-900" : ""
          }`}
        >
          Ver todos ({projects.length})
        </Link>
      </div>
    </aside>
  );
}
