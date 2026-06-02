"use client";

import { useEffect, useState } from "react";

import {
  OPERATIVO_BOARD_MIN_WIDTH_PX,
  OPERATIVO_BOARD_MIN_WIDTH_WITH_SELECTION_PX,
} from "@/modules/pm/actas/logic/element-display";
import { getCategoryGroupStyle } from "@/modules/pm/actas/logic/category-group-style";
import type {
  ActasOperativoCategory,
  ElementStatus,
} from "@/modules/pm/actas/types";

import type { ActasRootElementOption } from "@/modules/pm/actas/logic/collect-root-elements";

import { ActasAddElementModal } from "./ActasAddElementModal";
import { ActasCategoryNameCell } from "./ActasCategoryNameCell";
import { OperativoCategoryRootList } from "./ActasOperativoElementBranch";
import { ActasOperativoColumnHeader } from "./ActasOperativoColumnHeader";

interface ActasCategoryGroupProps {
  category: ActasOperativoCategory;
  categories: ActasOperativoCategory[];
  parentOptions: ActasRootElementOption[];
  projectCode: string;
  currentAuthUserId: string | null;
  isPmAdmin?: boolean;
  hasWriteAccess?: boolean;
  defaultExpanded?: boolean;
  readOnly?: boolean;
  asOfDate?: string;
  showCompletedStyle?: boolean;
  onElementStatusLiveChange?: (
    elementId: string,
    status: ElementStatus,
  ) => void;
  onElementArchived?: (message: string) => void;
  onToast?: (message: string) => void;
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
  categories,
  parentOptions,
  projectCode,
  currentAuthUserId,
  isPmAdmin = false,
  hasWriteAccess = true,
  defaultExpanded = true,
  readOnly = false,
  asOfDate,
  showCompletedStyle = false,
  onElementStatusLiveChange,
  onElementArchived,
  onToast,
}: ActasCategoryGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [addElementOpen, setAddElementOpen] = useState(false);
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
              projectCode={projectCode}
              currentAuthUserId={currentAuthUserId}
              isPmAdmin={isPmAdmin}
              hasWriteAccess={hasWriteAccess}
              readOnly={readOnly}
              asOfDate={asOfDate}
              showAsCompleted={showCompletedStyle}
              onElementStatusLiveChange={onElementStatusLiveChange}
              onElementArchived={onElementArchived}
              onToast={onToast}
            />
          )}

          {!readOnly && hasWriteAccess ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-subtle/40 px-4 py-2.5 text-sm text-icam-900/80 hover:bg-icam-900/5 transition-colors"
              onClick={() => setAddElementOpen(true)}
            >
              <span className="text-lg leading-none font-light" aria-hidden>
                +
              </span>
              Añadir elemento
            </button>
          ) : null}
          </div>
        </div>
      ) : null}

      {!readOnly && hasWriteAccess ? (
        <ActasAddElementModal
          open={addElementOpen}
          defaultCategoryId={category.id}
          categories={categories}
          parentOptions={parentOptions}
          onClose={() => setAddElementOpen(false)}
        />
      ) : null}
    </section>
  );
}
