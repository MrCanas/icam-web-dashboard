"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restoreProject } from "@/modules/pm/actas/actions/restore-project";
import {
  actasArchivedProjectsPath,
  actasHubPath,
  actasProjectPath,
} from "@/modules/pm/actas/logic/actas-paths";
import type { ActasArchivedProjectRef } from "@/modules/pm/actas/types";

function formatArchivedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface ActasProjectArchivedScreenProps {
  project: ActasArchivedProjectRef;
  /** Panel del activo PM vinculado; añade «Volver al proyecto» a la botonera. */
  backToProjectHref?: string;
}

export function ActasProjectArchivedScreen({
  project,
  backToProjectHref,
}: ActasProjectArchivedScreenProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleRestore = () => {
    setError(null);
    startTransition(async () => {
      const res = await restoreProject({ projectId: project.id });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(actasProjectPath(res.projectCode));
      router.refresh();
    });
  };

  return (
    <section className="bg-card rounded-lg border border-amber-200/80 p-6 max-w-lg">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
        Proyecto archivado
      </p>
      <h2 className="mt-2 font-mono text-lg font-semibold text-text-primary">
        {project.code}
      </h2>
      <p className="mt-1 text-sm text-text-muted">{project.name}</p>
      <p className="mt-2 text-xs text-text-muted">
        Archivado el {formatArchivedDate(project.archivedAt)}
      </p>

      <p className="mt-4 text-sm text-text-primary leading-relaxed">
        Este proyecto está archivado. Su estructura e histórico se conservan en
        base de datos pero no aparece en el listado principal.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-10 rounded-md bg-icam-900 px-4 text-sm font-medium text-white hover:bg-icam-800 disabled:opacity-40"
          disabled={pending}
          onClick={handleRestore}
        >
          {pending ? "Restaurando…" : "Restaurar"}
        </button>
        {backToProjectHref ? (
          <Link
            href={backToProjectHref}
            className="min-h-10 inline-flex items-center rounded-md border border-subtle/60 px-4 text-sm font-medium text-text-primary hover:bg-page"
          >
            Volver al proyecto
          </Link>
        ) : null}
        <Link
          href={actasHubPath()}
          className="min-h-10 inline-flex items-center rounded-md border border-subtle/60 px-4 text-sm font-medium text-text-primary hover:bg-page"
        >
          Volver a la lista
        </Link>
        <Link
          href={actasArchivedProjectsPath()}
          className="min-h-10 inline-flex items-center rounded-md px-4 text-sm text-text-muted hover:text-icam-900"
        >
          Ver archivados
        </Link>
      </div>
    </section>
  );
}
