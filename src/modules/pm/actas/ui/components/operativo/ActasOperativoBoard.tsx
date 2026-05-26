"use client";

import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

import { ActasCategoryGroup } from "./ActasCategoryGroup";

interface ActasOperativoBoardProps {
  categories: ActasOperativoCategory[];
  projectCode: string;
}

export function ActasOperativoBoard({
  categories,
  projectCode,
}: ActasOperativoBoardProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-b-lg border border-t-0 border-subtle/50 bg-card p-8 text-center">
        <p className="text-sm text-text-muted">
          Este proyecto no tiene categorías operativas todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-b-lg border border-t-0 border-subtle/50 bg-page/40 p-4">
      {categories.map((category) => (
        <ActasCategoryGroup
          key={category.id}
          category={category}
          projectCode={projectCode}
        />
      ))}

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-subtle bg-card px-4 py-3 text-sm font-medium text-icam-900 hover:bg-icam-900/5 transition-colors"
      >
        <span className="text-lg leading-none font-light" aria-hidden>
          +
        </span>
        Añadir categoría
      </button>
    </div>
  );
}
