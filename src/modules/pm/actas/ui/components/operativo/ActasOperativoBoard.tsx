"use client";

import { useEffect, useMemo, useState } from "react";

import { ActasAddCategoryModal } from "./ActasAddCategoryModal";

import { collectRootElementOptions } from "@/modules/pm/actas/logic/collect-root-elements";
import { filterOperativoCategories } from "@/modules/pm/actas/logic/operativo-done-filter";
import { mergeVisibleOperativoTrees } from "@/modules/pm/actas/logic/merge-visible-operativo-tree";
import type {
  ActasOperativoCategory,
  ElementStatus,
} from "@/modules/pm/actas/types";

import { ActasCategoryGroup } from "./ActasCategoryGroup";
import { ActasBulkSelectionBar } from "./ActasBulkSelectionBar";
import { ActasLogEntryUndoProvider } from "./ActasLogEntryUndoContext";
import { ActasOperativoSelectionProvider } from "./ActasOperativoSelectionContext";
import { ActasOperativoDndProvider } from "./ActasOperativoDndContext";
import { useShowCompletedOperativo } from "./ActasOperativoShowCompletedToggle";

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
  const { showCompleted } = useShowCompletedOperativo();
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, ElementStatus>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [displayCategories, setDisplayCategories] = useState(categories);
  const [isDndMutating, setIsDndMutating] = useState(false);
  const enableDragDrop = !readOnly && hasWriteAccess;
  const enableSelection = !readOnly && hasWriteAccess;

  useEffect(() => {
    if (isDndMutating) return;
    setDisplayCategories(categories);
  }, [categories, isDndMutating]);

  const filteredCategories = useMemo(
    () =>
      filterOperativoCategories(
        displayCategories,
        showCompleted,
        statusOverrides,
      ),
    [displayCategories, showCompleted, statusOverrides],
  );

  const parentOptions = useMemo(
    () => collectRootElementOptions(filteredCategories),
    [filteredCategories],
  );

  const handleStatusOverride = (elementId: string, status: ElementStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [elementId]: status }));
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
      {filteredCategories.length === 0 ? (
        <p className="rounded-md border border-dashed border-subtle/60 bg-card px-4 py-8 text-center text-sm text-text-muted">
          {showCompleted
            ? "No hay elementos activos en este proyecto."
            : "Todos los elementos visibles están completados. Activa «Mostrar completados» o abre la pestaña Completados."}
        </p>
      ) : (
        filteredCategories.map((category) => (
          <ActasCategoryGroup
            key={category.id}
            category={category}
            categories={displayCategories}
            parentOptions={parentOptions}
            projectCode={projectCode}
            currentAuthUserId={currentAuthUserId}
            isPmAdmin={isPmAdmin}
            hasWriteAccess={hasWriteAccess && !readOnly}
            readOnly={readOnly}
            asOfDate={asOfDate}
            showCompletedStyle={showCompleted}
            onElementStatusLiveChange={handleStatusOverride}
            onElementArchived={readOnly ? undefined : showToast}
            onToast={readOnly ? undefined : showToast}
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
          baseCategories={displayCategories}
          onCategoriesChange={(nextVisible) =>
            setDisplayCategories((prev) =>
              mergeVisibleOperativoTrees(prev, nextVisible),
            )
          }
          onMutatingChange={setIsDndMutating}
          onError={showToast}
        >
          {categoryList}
        </ActasOperativoDndProvider>
      ) : (
        categoryList
      )}

      {!readOnly && hasWriteAccess ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-subtle bg-card px-4 py-3 text-sm font-medium text-icam-900 hover:bg-icam-900/5 transition-colors"
          onClick={() => setAddCategoryOpen(true)}
        >
          <span className="text-lg leading-none font-light" aria-hidden>
            +
          </span>
          Nuevo grupo
        </button>
      ) : null}

      {!readOnly && hasWriteAccess ? (
        <ActasAddCategoryModal
          open={addCategoryOpen}
          projectId={projectId}
          onClose={() => setAddCategoryOpen(false)}
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

  return <ActasLogEntryUndoProvider>{wrapped}</ActasLogEntryUndoProvider>;
}
