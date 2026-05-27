"use client";

import { useState, useTransition } from "react";

import { archiveProject } from "@/modules/pm/actas/actions/archive-project";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

interface ActasArchiveProjectModalProps {
  source: ActasProjectListItem | null;
  open: boolean;
  onClose: () => void;
  onArchived: (projectCode: string) => void;
}

export function ActasArchiveProjectModal({
  source,
  open,
  onClose,
  onArchived,
}: ActasArchiveProjectModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open || !source) return null;

  const handleConfirm = () => {
    setSubmitError(null);
    startTransition(async () => {
      const res = await archiveProject({ projectId: source.id });
      if (!res.ok) {
        setSubmitError(res.error);
        return;
      }
      onArchived(res.projectCode);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="actas-archive-project-title"
        className="w-full max-w-md rounded-xl border border-subtle/60 bg-card shadow-xl"
      >
        <header className="border-b border-subtle/40 px-5 py-4">
          <h2
            id="actas-archive-project-title"
            className="text-lg font-semibold text-text-primary"
          >
            Archivar {source.code}
          </h2>
        </header>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-text-muted leading-relaxed">
            El proyecto y todo su contenido (categorías, elementos, histórico)
            quedarán ocultos pero no borrados. Puedes restaurarlo desde
            &quot;Proyectos archivados&quot;.
          </p>

          {submitError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          ) : null}

          <footer className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="min-h-10 rounded-md border border-subtle/60 px-4 text-sm font-medium text-text-primary hover:bg-page disabled:opacity-50"
              disabled={pending}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="min-h-10 rounded-md bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={pending}
              onClick={handleConfirm}
            >
              {pending ? "Archivando…" : "Archivar"}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
