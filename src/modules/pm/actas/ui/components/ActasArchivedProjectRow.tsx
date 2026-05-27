"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { restoreProject } from "@/modules/pm/actas/actions/restore-project";
import type { ActasArchivedProjectListItem } from "@/modules/pm/actas/types";

function KebabIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="8" cy="3" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="8" cy="13" r="1.25" />
    </svg>
  );
}

function formatArchivedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

interface ActasArchivedProjectRowProps {
  project: ActasArchivedProjectListItem;
  onRestored: (projectCode: string) => void;
}

export function ActasArchivedProjectRow({
  project,
  onRestored,
}: ActasArchivedProjectRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleRestore = () => {
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await restoreProject({ projectId: project.id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onRestored(res.projectCode);
    });
  };

  return (
    <div className="group relative flex items-stretch rounded-md border border-subtle/40 bg-page px-3 py-3">
      <div className="min-w-0 flex-1 pr-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-icam-900">
            {project.code}
          </span>
          <span className="inline-flex rounded-md border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Archivado
          </span>
        </div>
        <p className="mt-1 text-sm text-text-primary line-clamp-2">
          {project.name}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Archivado el {formatArchivedDate(project.archivedAt)}
        </p>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </div>

      <div ref={menuRef} className="absolute right-2 top-2 z-10">
        <button
          type="button"
          aria-label={`Opciones de ${project.code}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-icam-900/10 hover:text-icam-900"
          disabled={pending}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <KebabIcon />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full mt-0.5 min-w-[11rem] rounded-md border border-subtle/60 bg-card py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-page disabled:opacity-50"
              disabled={pending}
              onClick={handleRestore}
            >
              {pending ? "Restaurando…" : "Restaurar proyecto"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
