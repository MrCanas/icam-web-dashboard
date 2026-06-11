"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { createElement } from "@/modules/pm/actas/actions/create-element";
import {
  OPERATIVO_BOARD_MIN_WIDTH_PX,
  OPERATIVO_BOARD_MIN_WIDTH_WITH_SELECTION_PX,
} from "@/modules/pm/actas/logic/element-display";
import {
  DEFAULT_ELEMENT_NAME,
  nextDefaultName,
} from "@/modules/pm/actas/logic/default-element-name";
import { getCategoryGroupStyle } from "@/modules/pm/actas/logic/category-group-style";
import type {
  ActasOperativoCategory,
  ElementStatus,
} from "@/modules/pm/actas/types";
import type { ActasDoneElementRef } from "@/modules/pm/actas/logic/operativo-done-filter";

import type { OperativoOptimisticAction } from "@/modules/pm/actas/logic/operativo-optimistic";

import { ActasArchivedElementsSection } from "./ActasArchivedElementsSection";
import { ActasCategoryNameCell } from "./ActasCategoryNameCell";
import { ActasElementRow } from "./ActasElementRow";
import { useInlineCreate } from "./ActasInlineCreateContext";
import { OperativoCategoryRootList } from "./ActasOperativoElementBranch";
import { ActasOperativoColumnHeader } from "./ActasOperativoColumnHeader";

interface ActasCategoryGroupProps {
  category: ActasOperativoCategory;
  allCategories: ActasOperativoCategory[];
  completedElements?: ActasDoneElementRef[];
  projectCode: string;
  currentAuthUserId: string | null;
  isPmAdmin?: boolean;
  hasWriteAccess?: boolean;
  defaultExpanded?: boolean;
  readOnly?: boolean;
  asOfDate?: string;
  onElementStatusLiveChange?: (
    elementId: string,
    status: ElementStatus,
  ) => void;
  onElementArchived?: (message: string) => void;
  onToast?: (message: string) => void;
  onOptimisticAction?: (action: OperativoOptimisticAction) => void;
}

function countElements(elements: ActasOperativoCategory["elements"]): number {
  let n = 0;
  const walk = (list: ActasOperativoCategory["elements"]) => {
    for (const el of list) {
      n += 1;
      walk(el.children);
    }
  };
  walk(elements);
  return n;
}

export function ActasCategoryGroup({
  category,
  allCategories,
  completedElements = [],
  projectCode,
  currentAuthUserId,
  isPmAdmin = false,
  hasWriteAccess = true,
  defaultExpanded = true,
  readOnly = false,
  asOfDate,
  onElementStatusLiveChange,
  onElementArchived,
  onToast,
  onOptimisticAction,
}: ActasCategoryGroupProps) {
  const router = useRouter();
  const inlineCreate = useInlineCreate();
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [categoryName, setCategoryName] = useState(category.name);
  const [categoryDisplayName, setCategoryDisplayName] = useState(
    category.displayName,
  );
  const style = getCategoryGroupStyle(category.masterGroupId, category.id);
  const itemCount = countElements(category.elements);
  const boardMinWidth =
    hasWriteAccess && !readOnly
      ? OPERATIVO_BOARD_MIN_WIDTH_WITH_SELECTION_PX
      : OPERATIVO_BOARD_MIN_WIDTH_PX;

  useEffect(() => {
    setCategoryName(category.name);
    setCategoryDisplayName(category.displayName);
  }, [category.name, category.displayName]);

  const handleAddElement = () => {
    if (pending) return;
    const name = nextDefaultName(
      DEFAULT_ELEMENT_NAME,
      category.elements.map((e) => e.name),
    );
    setExpanded(true);
    startTransition(async () => {
      const result = await createElement({ categoryId: category.id, name });
      if (!result.ok) {
        onToast?.(result.error || "No se pudo guardar el cambio");
        return;
      }
      onOptimisticAction?.({
        type: "addElement",
        categoryId: category.id,
        parentElementId: null,
        elementId: result.elementId,
        name,
      });
      inlineCreate?.requestAutoEdit(result.elementId);
      router.refresh();
    });
  };

  return (
    <section className="rounded-md overflow-hidden border border-subtle/50 shadow-sm">
      <div
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-opacity hover:opacity-95"
        style={{ backgroundColor: style.bg, color: style.text }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold hover:bg-black/10"
          style={{ backgroundColor: "rgba(0,0,0,0.12)" }}
          aria-expanded={expanded}
          aria-label={expanded ? "Colapsar grupo" : "Expandir grupo"}
        >
          {expanded ? "▾" : "▸"}
        </button>

        <ActasCategoryNameCell
          categoryId={category.id}
          name={readOnly ? category.name : categoryName}
          displayName={readOnly ? category.displayName : categoryDisplayName}
          hasWriteAccess={hasWriteAccess && !readOnly}
          readOnly={readOnly}
          headerTextColor={style.text}
          onRenamed={(name, displayName) => {
            setCategoryName(name);
            setCategoryDisplayName(displayName);
          }}
          onError={(msg) => onToast?.(msg)}
        />

        <span
          className="shrink-0 text-xs font-medium opacity-90 tabular-nums"
          style={{ color: style.text }}
        >
          {itemCount} {itemCount === 1 ? "elemento" : "elementos"}
        </span>
      </div>

      {expanded ? (
        <div className="bg-card overflow-x-auto">
          <div style={{ minWidth: boardMinWidth }}>
          <ActasOperativoColumnHeader
            showSelectionColumn={hasWriteAccess && !readOnly}
          />
          {category.elements.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted italic">
              Sin elementos en esta categoría.
            </p>
          ) : (
            <OperativoCategoryRootList
              categoryId={category.id}
              elements={category.elements}
              allCategories={allCategories}
              projectCode={projectCode}
              currentAuthUserId={currentAuthUserId}
              isPmAdmin={isPmAdmin}
              hasWriteAccess={hasWriteAccess}
              readOnly={readOnly}
              asOfDate={asOfDate}
              onElementStatusLiveChange={onElementStatusLiveChange}
              onElementArchived={onElementArchived}
              onToast={onToast}
            />
          )}

          {completedElements.length > 0 ? (
            <div className="border-t border-subtle/40 bg-page/30">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-emerald-800 hover:bg-emerald-600/5"
                aria-expanded={completedExpanded}
                onClick={() => setCompletedExpanded((v) => !v)}
              >
                <span className="text-[10px]">{completedExpanded ? "▾" : "▸"}</span>
                Completados ({completedElements.length})
              </button>
              {completedExpanded ? (
                <div className="border-t border-subtle/30">
                  {completedElements.map(({ element, depth }) => (
                    <ActasElementRow
                      key={element.id}
                      element={element}
                      projectCode={projectCode}
                      currentAuthUserId={currentAuthUserId}
                      isPmAdmin={isPmAdmin}
                      hasWriteAccess={hasWriteAccess}
                      depth={depth}
                      readOnly={readOnly}
                      asOfDate={asOfDate}
                      showAsCompleted
                      onElementStatusLiveChange={onElementStatusLiveChange}
                      onElementArchived={onElementArchived}
                      onToast={onToast}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {!readOnly && hasWriteAccess &&
          (category.archivedElements?.length ?? 0) > 0 ? (
            <ActasArchivedElementsSection
              archivedElements={category.archivedElements!}
              onToast={onToast}
            />
          ) : null}

          {!readOnly && hasWriteAccess ? (
            <button
              type="button"
              disabled={pending}
              className="flex w-full items-center gap-2 border-t border-subtle/40 px-4 py-2.5 text-sm text-icam-900/80 hover:bg-icam-900/5 transition-colors disabled:opacity-50"
              onClick={handleAddElement}
            >
              <span className="text-lg leading-none font-light" aria-hidden>
                +
              </span>
              {pending ? "Añadiendo…" : "Añadir elemento"}
            </button>
          ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
