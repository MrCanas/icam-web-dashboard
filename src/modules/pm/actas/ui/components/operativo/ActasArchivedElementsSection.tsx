"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { deleteElement } from "@/modules/pm/actas/actions/delete-element";
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
  const [confirmDelete, setConfirmDelete] =
    useState<ActasArchivedElementRef | null>(null);
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

  const handleDelete = (el: ActasArchivedElementRef) => {
    if (pendingId) return;
    setPendingId(el.id);
    startTransition(async () => {
      const result = await deleteElement(el.id);
      if (!result.ok) {
        onToast?.(result.error || "No se pudo eliminar el elemento");
        setPendingId(null);
        return;
      }
      setConfirmDelete(null);
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
                {pendingId === el.id ? "…" : "Restaurar"}
              </button>
              <button
                type="button"
                disabled={pendingId === el.id}
                aria-label={`Eliminar permanentemente ${el.name}`}
                title="Eliminar permanentemente"
                onClick={() => setConfirmDelete(el)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-subtle text-text-muted hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {confirmDelete && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setConfirmDelete(null)}
            >
              <div
                className="w-full max-w-md rounded-lg border border-subtle/60 bg-card p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-base font-semibold text-text-primary">
                  Eliminar permanentemente
                </h2>
                <p className="mt-2 text-sm text-text-body">
                  ¿Eliminar permanentemente «{confirmDelete.name}»?
                  {confirmDelete.descendantCount > 0
                    ? ` Se borrarán sus ${confirmDelete.descendantCount} subelemento${confirmDelete.descendantCount === 1 ? "" : "s"},`
                    : " Se borrarán"}{" "}
                  entradas de histórico y adjuntos. Esta acción no se puede
                  deshacer.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={pendingId === confirmDelete.id}
                    className="rounded-md border border-subtle px-4 py-2 text-sm text-text-body hover:bg-page"
                    onClick={() => setConfirmDelete(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === confirmDelete.id}
                    className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    onClick={() => handleDelete(confirmDelete)}
                  >
                    {pendingId === confirmDelete.id ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
