"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";

import { restoreLogEntry } from "@/modules/pm/actas/actions/restore-log-entry";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

const UNDO_WINDOW_MS = 30_000;

type UndoPayload = {
  logEntryId: string;
  expiresAt: number;
  onRestored: (entry: ActasLogEntryItem) => void;
};

type ActasLogEntryUndoContextValue = {
  showUndo: (payload: Omit<UndoPayload, "expiresAt"> & { expiresAt?: number }) => void;
};

const ActasLogEntryUndoContext = createContext<ActasLogEntryUndoContextValue | null>(
  null,
);

export function useActasLogEntryUndo(): ActasLogEntryUndoContextValue {
  const ctx = useContext(ActasLogEntryUndoContext);
  if (!ctx) {
    throw new Error("useActasLogEntryUndo debe usarse dentro de ActasLogEntryUndoProvider");
  }
  return ctx;
}

function ActasUndoSnackbar({
  undo,
  onDismiss,
}: {
  undo: UndoPayload;
  onDismiss: () => void;
}) {
  const [canUndoUi, setCanUndoUi] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const remaining = undo.expiresAt - Date.now();
    if (remaining <= 0) {
      setCanUndoUi(false);
      return;
    }
    const timer = window.setTimeout(() => setCanUndoUi(false), remaining);
    return () => window.clearTimeout(timer);
  }, [undo.expiresAt]);

  const handleRestore = () => {
    setRestoreError(null);
    startTransition(async () => {
      const result = await restoreLogEntry({ logEntryId: undo.logEntryId });
      if (!result.ok) {
        setRestoreError(result.error);
        return;
      }
      undo.onRestored(result.entry);
      onDismiss();
    });
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex flex-col gap-1 max-w-md w-[calc(100%-2rem)]"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-subtle/80 bg-card px-4 py-3 shadow-lg">
        <span className="text-sm text-text-body">Entrada borrada.</span>
        <div className="flex items-center gap-2 shrink-0">
          {canUndoUi ? (
            <button
              type="button"
              onClick={handleRestore}
              disabled={pending}
              className="text-sm font-medium text-icam-900 hover:text-icam-gold underline disabled:opacity-50"
            >
              {pending ? "Restaurando…" : "Deshacer"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-text-muted hover:text-text-body"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>
      {restoreError ? (
        <p className="text-xs text-red-600 text-center bg-card rounded px-2 py-1 shadow">
          {restoreError}
        </p>
      ) : null}
    </div>
  );
}

export function ActasLogEntryUndoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [undo, setUndo] = useState<UndoPayload | null>(null);

  const showUndo = useCallback(
    (payload: Omit<UndoPayload, "expiresAt"> & { expiresAt?: number }) => {
      setUndo({
        ...payload,
        expiresAt: payload.expiresAt ?? Date.now() + UNDO_WINDOW_MS,
      });
    },
    [],
  );

  return (
    <ActasLogEntryUndoContext.Provider value={{ showUndo }}>
      {children}
      {undo ? (
        <ActasUndoSnackbar undo={undo} onDismiss={() => setUndo(null)} />
      ) : null}
    </ActasLogEntryUndoContext.Provider>
  );
}
