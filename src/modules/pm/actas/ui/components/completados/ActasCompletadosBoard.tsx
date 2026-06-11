"use client";

import { useMemo, useState } from "react";

import {
  collectDoneElements,
  groupDoneElementsByCategory,
} from "@/modules/pm/actas/logic/operativo-done-filter";
import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";
import type {
  ActasOperativoCategory,
  ElementStatus,
} from "@/modules/pm/actas/types";

import { ActasElementRow } from "../operativo/ActasElementRow";
import { ActasLogEntryUndoProvider } from "../operativo/ActasLogEntryUndoContext";
import { ActasOperativoColumnHeader } from "../operativo/ActasOperativoColumnHeader";

interface ActasCompletadosBoardProps {
  categories: ActasOperativoCategory[];
  projectCode: string;
  currentAuthUserId: string | null;
  isPmAdmin?: boolean;
  hasWriteAccess?: boolean;
}

export function ActasCompletadosBoard({
  categories,
  projectCode,
  currentAuthUserId,
  isPmAdmin = false,
  hasWriteAccess = true,
}: ActasCompletadosBoardProps) {
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ElementStatus>
  >({});
  const [toast, setToast] = useState<string | null>(null);

  const doneByCategory = useMemo(() => {
    const items = collectDoneElements(categories, statusOverrides);
    return groupDoneElementsByCategory(items);
  }, [categories, statusOverrides]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const handleStatusOverride = (elementId: string, status: ElementStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [elementId]: status }));
  };

  if (doneByCategory.size === 0) {
    return (
      <section className="rounded-b-lg border border-t-0 border-subtle/50 bg-card p-8 text-center">
        <p className="text-sm text-text-muted">
          No hay elementos en estado «Hecho» en este proyecto.
        </p>
      </section>
    );
  }

  return (
    <ActasLogEntryUndoProvider>
      <div className="flex flex-col gap-4 rounded-b-lg border border-t-0 border-subtle/50 bg-page/40 p-4">
        <p className="text-sm text-text-muted">
          Elementos marcados como completados. Haz clic en una fila para ver el
          histórico.
        </p>

        {[...doneByCategory.entries()].map(([categoryId, group]) => (
          <section
            key={categoryId}
            className="rounded-md overflow-hidden border border-subtle/50 shadow-sm"
          >
            <header className="border-b border-subtle/40 bg-page/80 px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {group.displayName}
              </h3>
            </header>
            <div className="bg-card overflow-x-auto">
              <div style={{ minWidth: OPERATIVO_BOARD_MIN_WIDTH_PX }}>
                <ActasOperativoColumnHeader />
                {group.items.map(({ element, depth }) => (
                  <ActasElementRow
                    key={element.id}
                    element={element}
                    projectCode={projectCode}
                    currentAuthUserId={currentAuthUserId}
                    isPmAdmin={isPmAdmin}
                    hasWriteAccess={hasWriteAccess}
                    depth={depth}
                    showAsCompleted
                    onElementStatusLiveChange={handleStatusOverride}
                    onToast={showToast}
                  />
                ))}
              </div>
            </div>
          </section>
        ))}

        {toast ? (
          <div
            className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-icam-900/20 bg-card px-4 py-2.5 text-sm font-medium text-icam-900 shadow-lg"
            role="status"
          >
            {toast}
          </div>
        ) : null}
      </div>
    </ActasLogEntryUndoProvider>
  );
}
