"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import {
  actasArchivedProjectsPath,
  actasHubPath,
  actasProjectPath,
} from "@/modules/pm/actas/logic/actas-paths";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

import { ActasArchiveProjectModal } from "./ActasArchiveProjectModal";
import { ActasCreateProjectModal } from "./ActasCreateProjectModal";
import {
  ActasDuplicateProjectModal,
  type DuplicateProjectSuccess,
} from "./ActasDuplicateProjectModal";
import { ActasProjectSidebarItem } from "./ActasProjectSidebarItem";

interface ActasProjectSidebarProps {
  projects: ActasProjectListItem[];
  archivedCount: number;
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function projectMatchesQuery(project: ActasProjectListItem, query: string): boolean {
  if (!query) return true;
  const haystack = `${project.code} ${project.name}`.toLowerCase();
  return haystack.includes(query);
}

function NewProjectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full min-h-10 rounded-md bg-icam-900 px-4 text-sm font-medium text-white hover:bg-icam-800 transition"
    >
      + Nuevo proyecto
    </button>
  );
}

function ArchivedProjectsLink({
  count,
  active,
}: {
  count: number;
  active: boolean;
}) {
  if (count <= 0) return null;
  return (
    <Link
      href={actasArchivedProjectsPath()}
      className={`block rounded-md px-2 py-2 text-xs hover:bg-page ${
        active
          ? "font-medium text-icam-900"
          : "text-text-muted hover:text-text-primary"
      }`}
    >
      Proyectos archivados ({count})
    </Link>
  );
}

export function ActasProjectSidebar({
  projects,
  archivedCount,
}: ActasProjectSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] =
    useState<ActasProjectListItem | null>(null);
  const [archiveSource, setArchiveSource] =
    useState<ActasProjectListItem | null>(null);
  const [toast, setToast] = useState<ReactNode | null>(null);

  const archivedLinkActive = pathname === actasArchivedProjectsPath();

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return projects.filter((p) => projectMatchesQuery(p, q));
  }, [projects, search]);

  const showToast = (content: ReactNode) => {
    setToast(content);
    window.setTimeout(() => setToast(null), 6000);
  };

  const handleCreated = (projectCode: string) => {
    setCreateModalOpen(false);
    showToast(`Proyecto ${projectCode} creado`);
    router.push(actasProjectPath(projectCode));
    router.refresh();
  };

  const handleDuplicated = (result: DuplicateProjectSuccess) => {
    setDuplicateSource(null);
    const message = result.structureEmpty
      ? `${result.sourceCode} duplicado como ${result.newCode} (proyecto sin estructura)`
      : `${result.sourceCode} duplicado como ${result.newCode}`;
    showToast(message);
    router.push(actasProjectPath(result.newCode));
    router.refresh();
  };

  const handleArchived = (projectCode: string) => {
    setArchiveSource(null);
    const href = actasProjectPath(projectCode);
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      router.push(actasHubPath());
    }
    showToast(
      <>
        Proyecto {projectCode} archivado.{" "}
        <Link
          href={actasArchivedProjectsPath()}
          className="font-semibold underline hover:text-icam-900"
        >
          Ver archivados
        </Link>
      </>,
    );
    router.refresh();
  };

  const sidebarHeader = (
    <div className="border-b border-subtle/40 p-3 space-y-3">
      <NewProjectButton onClick={() => setCreateModalOpen(true)} />
      <div>
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
    </div>
  );

  const sidebarFooter = (
    <div className="border-t border-subtle/40 p-2 space-y-0.5">
      <ArchivedProjectsLink count={archivedCount} active={archivedLinkActive} />
      {projects.length > 0 ? (
        <Link
          href={actasHubPath()}
          className={`block rounded-md px-2 py-2 text-xs text-text-muted hover:bg-page hover:text-text-primary ${
            pathname === actasHubPath() ? "font-medium text-icam-900" : ""
          }`}
        >
          Ver todos ({projects.length})
        </Link>
      ) : null}
    </div>
  );

  return (
    <>
      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-md border border-icam-900/20 bg-card px-4 py-2.5 text-sm text-icam-900 shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <ActasCreateProjectModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
      />

      <ActasDuplicateProjectModal
        source={duplicateSource}
        open={duplicateSource != null}
        onClose={() => setDuplicateSource(null)}
        onDuplicated={handleDuplicated}
      />

      <ActasArchiveProjectModal
        source={archiveSource}
        open={archiveSource != null}
        onClose={() => setArchiveSource(null)}
        onArchived={handleArchived}
      />

      {!projects.length ? (
        <aside className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-subtle/50 bg-card lg:w-72">
          <div className="p-3">
            <p className="text-sm font-medium text-text-primary">Proyectos</p>
          </div>
          {sidebarHeader}
          <div className="mx-3 rounded-md border border-dashed border-subtle/60 bg-page p-4 text-center">
            <p className="text-sm text-text-muted">
              Crea tu primer proyecto con el catálogo maestro
            </p>
          </div>
          {sidebarFooter}
        </aside>
      ) : (
        <aside className="flex w-full shrink-0 flex-col gap-3 rounded-lg border border-subtle/50 bg-card lg:w-72 lg:max-h-[calc(100vh-14rem)]">
          {sidebarHeader}

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
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <ActasProjectSidebarItem
                    key={project.id}
                    project={project}
                    active={active}
                    onDuplicate={setDuplicateSource}
                    onArchive={setArchiveSource}
                  />
                );
              })
            )}
          </nav>

          {sidebarFooter}
        </aside>
      )}
    </>
  );
}
