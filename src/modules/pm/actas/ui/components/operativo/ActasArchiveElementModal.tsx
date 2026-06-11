"use client";

import { useEffect, useTransition } from "react";

import { archiveElement } from "@/modules/pm/actas/actions/archive-element";

interface ActasArchiveElementModalProps {
  elementId: string;
  elementName: string;
  descendantCount: number;
  onClose: () => void;
  onArchived: (payload: { elementName: string; archivedCount: number }) => void;
}

export function ActasArchiveElementModal({
  elementId,
  elementName,
  descendantCount,
  onClose,
  onArchived,
}: ActasArchiveElementModalProps) {
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await archiveElement({ elementId });
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      onArchived({ elementName, archivedCount: result.archivedCount });
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-element-title"
        className="w-full max-w-md rounded-lg border border-subtle/60 bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="archive-element-title"
          className="text-base font-semibold text-text-primary"
        >
          Eliminar elemento
        </h2>
        <p className="mt-2 text-sm text-text-body leading-relaxed">
          ¿Eliminar <strong>{elementName}</strong>? El elemento se ocultará de la
          vista pero su histórico se conserva. Esta acción no se puede deshacer
          desde la UI.
        </p>
        {descendantCount > 0 ? (
          <p className="mt-2 text-sm text-amber-900/90">
            Esto también ocultará sus {descendantCount} sub-elemento
            {descendantCount === 1 ? "" : "s"}.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-md border border-subtle px-4 py-2 text-sm text-text-body hover:bg-page disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}
