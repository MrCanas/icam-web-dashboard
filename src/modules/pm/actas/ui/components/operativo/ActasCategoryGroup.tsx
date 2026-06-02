"use client";

import { useState } from "react";

import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";
import { getCategoryGroupStyle } from "@/modules/pm/actas/logic/category-group-style";
import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

import type { ActasRootElementOption } from "@/modules/pm/actas/logic/collect-root-elements";

import { ActasAddElementModal } from "./ActasAddElementModal";
import { ActasElementRow } from "./ActasElementRow";
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
  onElementArchived,
  onToast,
}: ActasCategoryGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [addElementOpen, setAddElementOpen] = useState(false);
  const style = getCategoryGroupStyle(category.masterGroupId, category.id);
  const itemCount = countElements(category.elements);

  return (
    <section className="rounded-md overflow-hidden border border-subtle/50 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-opacity hover:opacity-95"
        style={{ backgroundColor: style.bg, color: style.text }}
        aria-expanded={expanded}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold"
          style={{ backgroundColor: "rgba(0,0,0,0.12)" }}
          aria-hidden
        >
          {expanded ? "▾" : "▸"}
        </span>
        <span className="flex-1 min-w-0 font-semibold text-sm uppercase tracking-wide truncate">
          {category.displayName}
        </span>
        <span
          className="shrink-0 text-xs font-medium opacity-90 tabular-nums"
          style={{ color: style.text }}
        >
          {itemCount} {itemCount === 1 ? "elemento" : "elementos"}
        </span>
      </button>

      {expanded ? (
        <div className="bg-card overflow-x-auto">
          <div style={{ minWidth: OPERATIVO_BOARD_MIN_WIDTH_PX }}>
          <ActasOperativoColumnHeader />
          {category.elements.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted italic">
              Sin elementos en esta categoría.
            </p>
          ) : (
            category.elements.map((el) => (
              <ActasElementRow
                key={el.id}
                element={el}
                projectCode={projectCode}
                currentAuthUserId={currentAuthUserId}
                isPmAdmin={isPmAdmin}
                hasWriteAccess={hasWriteAccess}
                readOnly={readOnly}
                asOfDate={asOfDate}
                onElementArchived={onElementArchived}
                onToast={onToast}
              />
            ))
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
