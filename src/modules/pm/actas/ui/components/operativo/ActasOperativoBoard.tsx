"use client";

import { useMemo, useOptimistic, useState } from "react";

import {
  splitOperativoCategories,
} from "@/modules/pm/actas/logic/operativo-done-filter";
import {
  applyOperativoOptimisticAction,
  type OperativoOptimisticAction,
} from "@/modules/pm/actas/logic/operativo-optimistic";
import type {
  ActasOperativoCategory,
  ElementStatus,
} from "@/modules/pm/actas/types";

import { ActasCategoryGroup } from "./ActasCategoryGroup";
import { ActasBulkSelectionBar } from "./ActasBulkSelectionBar";
import { ActasLogEntryUndoProvider } from "./ActasLogEntryUndoContext";
import { ActasOperativoSelectionProvider } from "./ActasOperativoSelectionContext";
import { ActasOperativoDndProvider } from "./ActasOperativoDndContext";
import { ActasInlineCreateProvider } from "./ActasInlineCreateContext";
import { ActasAddGroupButton } from "./ActasAddGroupButton";

type ActasOperativoBoardProps = {
  categories: ActasOperativoCategory[];
  projectId: string;
  projectCode: string;
  currentAuthUserId: string | null;
  isPmAdmin?: boolean;
  hasWriteAccess?: boolean;
} & (
  | { mode: "live" }
  | { mode: "historical"; asOfDate: string }
);

export function ActasOperativoBoard(props: ActasOperativoBoardProps) {
  const {
    categories,
    projectId,
    projectCode,
    currentAuthUserId,
    mode,
    isPmAdmin = false,
    hasWriteAccess = true,
  } = props;
  const asOfDate = mode === "historical" ? props.asOfDate : undefined;
  const readOnly = mode === "historical";
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ElementStatus>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const [optimisticCategories, applyOptimisticCategories] = useOptimistic(
    categories,
    applyOperativoOptimisticAction,
  );
  const enableDragDrop = !readOnly && hasWriteAccess;
  const enableSelection = !readOnly && hasWriteAccess;

  const splitCategories = useMemo(
    () => splitOperativoCategories(optimisticCategories, statusOverrides),
    [optimisticCategories, statusOverrides],
  );

  const handleStatusOverride = (elementId: string, status: ElementStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [elementId]: status }));
  };

  const handleOptimisticAction = (action: OperativoOptimisticAction) => {
    applyOptimisticCategories(action);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  if (categories.length === 0) {
    return (
      <div className="rounded-b-lg border border-t-0 border-subtle/50 bg-card p-8 text-center">
        <p className="text-sm text-text-muted">
          Este proyecto no tiene categorías operativas todavía.
        </p>
      </div>
    );
  }

  const categoryList = (
    <>
      {splitCategories.length === 0 ? (
        <p className="rounded-md border border-dashed border-subtle/60 bg-card px-4 py-8 text-center text-sm text-text-muted">
          No hay elementos activos en este proyecto.
        </p>
      ) : (
        splitCategories.map((split) => (
          <ActasCategoryGroup
            key={split.category.id}
            category={{ ...split.category, elements: split.activeElements }}
            allCategories={optimisticCategories}
            completedElements={split.completedElements}
            projectCode={projectCode}
            currentAuthUserId={currentAuthUserId}
            isPmAdmin={isPmAdmin}
            hasWriteAccess={hasWriteAccess && !readOnly}
            readOnly={readOnly}
            asOfDate={asOfDate}
            onElementStatusLiveChange={handleStatusOverride}
            onElementArchived={readOnly ? undefined : showToast}
            onToast={readOnly ? undefined : showToast}
            onOptimisticAction={readOnly ? undefined : handleOptimisticAction}
          />
        ))
      )}
    </>
  );

  const board = (
    <div className="relative flex flex-col gap-3 rounded-b-lg border border-t-0 border-subtle/50 bg-page/40 p-4">
      {enableDragDrop ? (
        <ActasOperativoDndProvider
          projectId={projectId}
          projectCode={projectCode}
          categories={optimisticCategories}
          onError={showToast}
        >
          {categoryList}
        </ActasOperativoDndProvider>
      ) : (
        categoryList
      )}

      {!readOnly && hasWriteAccess ? (
        <ActasAddGroupButton
          projectId={projectId}
          existingNames={optimisticCategories.map((c) => c.name)}
          onOptimisticAction={handleOptimisticAction}
          onToast={showToast}
        />
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-icam-900/20 bg-card px-4 py-2.5 text-sm font-medium text-icam-900 shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );

  const wrapped = enableSelection ? (
    <ActasOperativoSelectionProvider
      enabled
      onStatusLiveChange={handleStatusOverride}
    >
      {board}
      <ActasBulkSelectionBar onError={showToast} />
    </ActasOperativoSelectionProvider>
  ) : (
    board
  );

  return (
    <ActasLogEntryUndoProvider>
      <ActasInlineCreateProvider>{wrapped}</ActasInlineCreateProvider>
    </ActasLogEntryUndoProvider>
  );
}
