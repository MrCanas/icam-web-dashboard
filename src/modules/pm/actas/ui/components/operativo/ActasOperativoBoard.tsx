"use client";

import { useState } from "react";

import { collectRootElementOptions } from "@/modules/pm/actas/logic/collect-root-elements";
import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

import { ActasCategoryGroup } from "./ActasCategoryGroup";
import { ActasLogEntryUndoProvider } from "./ActasLogEntryUndoContext";

type ActasOperativoBoardProps = {
  categories: ActasOperativoCategory[];
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
    projectCode,
    currentAuthUserId,
    mode,
    isPmAdmin = false,
    hasWriteAccess = true,
  } = props;
  const asOfDate = mode === "historical" ? props.asOfDate : undefined;
  const readOnly = mode === "historical";
  const parentOptions = collectRootElementOptions(categories);
  const [toast, setToast] = useState<string | null>(null);

  if (categories.length === 0) {
    return (
      <div className="rounded-b-lg border border-t-0 border-subtle/50 bg-card p-8 text-center">
        <p className="text-sm text-text-muted">
          Este proyecto no tiene categorías operativas todavía.
        </p>
      </div>
    );
  }

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const board = (
    <div className="relative flex flex-col gap-3 rounded-b-lg border border-t-0 border-subtle/50 bg-page/40 p-4">
      {categories.map((category) => (
        <ActasCategoryGroup
          key={category.id}
          category={category}
          categories={categories}
          parentOptions={parentOptions}
          projectCode={projectCode}
          currentAuthUserId={currentAuthUserId}
          isPmAdmin={isPmAdmin}
          hasWriteAccess={hasWriteAccess && !readOnly}
          readOnly={readOnly}
          asOfDate={asOfDate}
          onElementArchived={readOnly ? undefined : showToast}
          onToast={readOnly ? undefined : showToast}
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

  return <ActasLogEntryUndoProvider>{board}</ActasLogEntryUndoProvider>;
}
