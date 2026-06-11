"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restoreElement } from "@/modules/pm/actas/actions/restore-element";
import type { ActasArchivedElementRef } from "@/modules/pm/actas/types";

interface ActasArchivedElementsSectionProps {
  archivedElements: ActasArchivedElementRef[];
  onToast?: (message: string) => void;
}

/**
 * Sección colapsable "Archivados (N)" al final del grupo. Lista los elementos
 * archivados (soft-delete) con badge "Archivado" y un botón para restaurarlos.
 * Los elementos nunca se borran de la BD; restaurar pone `archived_at = null`.
 */
export function ActasArchivedElementsSection({
  archivedElements,
  onToast,
}: ActasArchivedElementsSectionProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (archivedElements.length === 0) return null;

  const handleRestore = (id: string) => {
    if (pendingId) return;
    setPendingId(id);
    startTransition(async () => {
      const result = await restoreElement({ elementId: id });
      if (!result.ok) {
        onToast?.(result.error || "No se pudo restaurar el elemento");
        setPendingId(null);
        return;
      }
      // El refresco re-renderiza el tablero: el elemento vuelve a activos y
      // desaparece de esta lista (se desmonta su fila).
      router.refresh();
    });
  };

  return (
    <div className="border-t border-subtle/40 bg-page/30">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted hover:bg-text-muted/5"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[10px]">{expanded ? "▾" : "▸"}</span>
        Archivados ({archivedElements.length})
      </button>

      {expanded ? (
        <div className="border-t border-subtle/30">
          {archivedElements.map((el) => (
            <div
              key={el.id}
              className="flex items-center gap-2 border-b border-subtle/30 px-4 py-2 last:border-b-0"
            >
              <span className="shrink-0 rounded bg-text-muted/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                Archivado
              </span>
              <span
                className="min-w-0 flex-1 truncate text-sm text-text-body"
                title={el.name}
              >
                {el.isSubelement ? (
                  <span className="mr-1 text-text-muted/70" aria-hidden>
                    └
                  </span>
                ) : null}
                {el.name}
                {el.descendantCount > 0 ? (
                  <span className="ml-1 text-xs text-text-muted">
                    (+{el.descendantCount} sub
                    {el.descendantCount === 1 ? "" : "s"})
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={pendingId === el.id}
                onClick={() => handleRestore(el.id)}
                className="shrink-0 rounded-md border border-subtle px-2.5 py-1 text-xs font-medium text-icam-900 hover:bg-icam-900/5 disabled:opacity-50"
              >
                {pendingId === el.id ? "Restaurando…" : "Restaurar"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
