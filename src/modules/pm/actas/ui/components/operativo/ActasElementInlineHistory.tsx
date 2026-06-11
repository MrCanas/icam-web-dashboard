"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { listElementLogEntries } from "@/modules/pm/actas/actions/list-element-log-entries";
import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";
import { formatAsOfDisplay } from "@/modules/pm/actas/logic/operativo-asof";
import { pickLatestActiveEntry } from "@/modules/pm/actas/logic/log-entry-helpers";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

import { useActasLogEntryUndo } from "./ActasLogEntryUndoContext";
import { ActasHistoryEntryItem } from "./ActasHistoryEntryItem";

interface ActasElementInlineHistoryProps {
  elementId: string;
  indentPx: number;
  currentAuthUserId: string | null;
  isPmAdmin: boolean;
  hasWriteAccess: boolean;
  reloadNonce?: number;
  readOnly?: boolean;
  asOfDate?: string;
  onLastEntryChange?: (latest: ActasLogEntryItem | null) => void;
}

export function ActasElementInlineHistory({
  elementId,
  indentPx,
  currentAuthUserId,
  isPmAdmin,
  hasWriteAccess,
  reloadNonce = 0,
  readOnly = false,
  asOfDate,
  onLastEntryChange,
}: ActasElementInlineHistoryProps) {
  const router = useRouter();
  const { showUndo } = useActasLogEntryUndo();
  const [entries, setEntries] = useState<ActasLogEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const syncLastEntry = useCallback(
    (list: ActasLogEntryItem[]) => {
      onLastEntryChange?.(pickLatestActiveEntry(list));
    },
    [onLastEntryChange],
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listElementLogEntries(elementId, asOfDate);
      if (!result.ok) {
        throw new Error(result.error);
      }
      const loaded = result.entries.filter((e) => e.deletedAt == null);
      setEntries(loaded);
      syncLastEntry(loaded);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error de carga");
      setEntries([]);
      syncLastEntry([]);
    } finally {
      setLoading(false);
    }
  }, [elementId, asOfDate, syncLastEntry]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries, reloadNonce]);

  const applyEntryListChange = (
    updater: (prev: ActasLogEntryItem[]) => ActasLogEntryItem[],
  ) => {
    setEntries((prev) => {
      const active = prev.filter((e) => e.deletedAt == null);
      const nextActive = updater(active);
      syncLastEntry(nextActive);
      return nextActive;
    });
  };

  return (
    <div
      className="border-b border-subtle/50 bg-page/40"
      style={{ paddingLeft: indentPx + 16, paddingRight: 16 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="py-2"
        style={{ minWidth: OPERATIVO_BOARD_MIN_WIDTH_PX - indentPx - 32 }}
      >
        {loading ? (
          <p className="text-xs text-text-muted px-1">Cargando histórico…</p>
        ) : null}
        {loadError ? (
          <p className="text-xs text-red-600 px-1">
            {loadError}{" "}
            <button type="button" className="underline" onClick={() => void loadEntries()}>
              Reintentar
            </button>
          </p>
        ) : null}
        {!loading && !loadError && entries.length === 0 ? (
          <p className="text-xs text-text-muted italic px-1">
            {readOnly
              ? "Sin entradas hasta esta fecha."
              : "Sin entradas en el histórico."}
          </p>
        ) : null}
        {!loading && !loadError && entries.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-text-muted border-b border-subtle/40">
                <th className="py-1 pr-2 font-medium w-[7rem]">Fecha</th>
                <th className="py-1 pr-2 font-medium w-[6rem]">Autor</th>
                <th className="py-1 pr-2 font-medium">Entrada</th>
                <th className="py-1 w-16" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <ActasHistoryEntryItem
                  key={entry.id}
                  entry={entry}
                  variant="inline"
                  currentAuthUserId={currentAuthUserId}
                  isPmAdmin={isPmAdmin}
                  hasWriteAccess={hasWriteAccess}
                  readOnly={readOnly}
                  onUpdated={(updated) => {
                    applyEntryListChange((prev) =>
                      prev.map((e) => (e.id === updated.id ? updated : e)),
                    );
                  }}
                  onDeleted={(deleted) => {
                    applyEntryListChange((prev) =>
                      prev.filter((e) => e.id !== deleted.id),
                    );
                    showUndo({
                      logEntryId: deleted.id,
                      onRestored: (restored) => {
                        applyEntryListChange((prev) => [...prev, restored]);
                        router.refresh();
                      },
                    });
                  }}
                />
              ))}
            </tbody>
          </table>
        ) : null}
        {readOnly && asOfDate ? (
          <p className="mt-1 text-[10px] text-text-muted italic px-1">
            Entradas hasta el {formatAsOfDisplay(asOfDate)}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
