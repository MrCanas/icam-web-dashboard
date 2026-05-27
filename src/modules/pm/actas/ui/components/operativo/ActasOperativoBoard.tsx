"use client";

import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

import { ActasCategoryGroup } from "./ActasCategoryGroup";
import { ActasLogEntryUndoProvider } from "./ActasLogEntryUndoContext";

type ActasOperativoBoardProps = {
  categories: ActasOperativoCategory[];
  projectCode: string;
  currentAuthUserId: string | null;
} & (
  | { mode: "live" }
  | { mode: "historical"; asOfDate: string }
);

export function ActasOperativoBoard(props: ActasOperativoBoardProps) {
  const { categories, projectCode, currentAuthUserId, mode } = props;
  const asOfDate = mode === "historical" ? props.asOfDate : undefined;
  const readOnly = mode === "historical";

  if (categories.length === 0) {
    return (
      <div className="rounded-b-lg border border-t-0 border-subtle/50 bg-card p-8 text-center">
        <p className="text-sm text-text-muted">
          Este proyecto no tiene categorías operativas todavía.
        </p>
      </div>
    );
  }

  const board = (
    <div className="flex flex-col gap-3 rounded-b-lg border border-t-0 border-subtle/50 bg-page/40 p-4">
      {categories.map((category) => (
        <ActasCategoryGroup
          key={category.id}
          category={category}
          projectCode={projectCode}
          currentAuthUserId={currentAuthUserId}
          readOnly={readOnly}
          asOfDate={asOfDate}
        />
      ))}

      {!readOnly ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-subtle bg-card px-4 py-3 text-sm font-medium text-icam-900 hover:bg-icam-900/5 transition-colors"
        >
          <span className="text-lg leading-none font-light" aria-hidden>
            +
          </span>
          Añadir categoría
        </button>
      ) : null}
    </div>
  );

  return <ActasLogEntryUndoProvider>{board}</ActasLogEntryUndoProvider>;
}
