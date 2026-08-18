"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { listElementLogEntries } from "@/modules/pm/actas/actions/list-element-log-entries";
import { actasProjectElementHistoricoPath } from "@/modules/pm/actas/logic/actas-paths";
import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";
import { formatAsOfDisplay } from "@/modules/pm/actas/logic/operativo-asof";
import { pickLatestActiveEntry } from "@/modules/pm/actas/logic/log-entry-helpers";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

import { useActasLogEntryUndo } from "./ActasLogEntryUndoContext";
import { ActasHistoryEntryItem } from "./ActasHistoryEntryItem";
import { useActasBasePath } from "@/modules/pm/actas/ui/ActasBasePathContext";

interface ActasElementHistoryPanelProps {
  elementId: string;
  elementName: string;
  projectCode: string;
  indentPx: number;
  currentAuthUserId: string | null;
  reloadNonce?: number;
  readOnly?: boolean;
  asOfDate?: string;
  onLastEntryChange?: (latest: ActasLogEntryItem | null) => void;
}

export function ActasElementHistoryPanel({
  elementId,
  elementName,
  projectCode,
  indentPx,
  currentAuthUserId,
  reloadNonce = 0,
  readOnly = false,
  asOfDate,
  onLastEntryChange,
}: ActasElementHistoryPanelProps) {
  const basePath = useActasBasePath();
  const router = useRouter();
  const { showUndo } = useActasLogEntryUndo();
  const [entries, setEntries] = useState<ActasLogEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

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
      setEntries(result.entries);
      syncLastEntry(result.entries);
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

  const visible = showDeleted
    ? entries
    : entries.filter((e) => e.deletedAt == null);
  const deletedCount = entries.filter((e) => e.deletedAt != null).length;

  const applyEntryListChange = (
    updater: (prev: ActasLogEntryItem[]) => ActasLogEntryItem[],
  ) => {
    setEntries((prev) => {
      const next = updater(prev);
      syncLastEntry(next);
      return next;
    });
  };

  const handleEntryUpdated = (updated: ActasLogEntryItem) => {
    applyEntryListChange((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e)),
    );
  };

  const handleEntryDeleted = (deleted: ActasLogEntryItem) => {
    applyEntryListChange((prev) =>
      prev.map((e) => (e.id === deleted.id ? deleted : e)),
    );

    showUndo({
      logEntryId: deleted.id,
      onRestored: (restored) => {
        applyEntryListChange((prev) =>
          prev.map((e) => (e.id === restored.id ? restored : e)),
        );
        router.refresh();
      },
    });
  };

  return (
    <div
      className="border-b border-subtle/50 bg-page/50"
      style={{ paddingLeft: indentPx + 16, paddingRight: 16 }}
    >
      <div
        className="py-3 space-y-3"
        style={{ minWidth: OPERATIVO_BOARD_MIN_WIDTH_PX - indentPx - 32 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Histórico — {elementName}
          </p>
          {!readOnly && deletedCount > 0 ? (
            <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="rounded border-subtle"
              />
              Mostrar borradas ({deletedCount})
            </label>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-text-muted">Cargando entradas…</p>
        ) : null}

        {loadError ? (
          <p className="text-sm text-red-600">
            {loadError}{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void loadEntries()}
            >
              Reintentar
            </button>
          </p>
        ) : null}

        {!loading && !loadError && visible.length === 0 ? (
          <p className="text-sm text-text-muted italic">
            {readOnly
              ? "Sin entradas hasta esta fecha."
              : entries.length > 0 && !showDeleted
                ? "Solo hay entradas borradas. Activa «Mostrar borradas»."
                : "Sin entradas en el histórico."}
          </p>
        ) : null}

        {!loading && !loadError && visible.length > 0 ? (
          <ul className="space-y-3">
            {visible.map((entry) => (
              <ActasHistoryEntryItem
                key={entry.id}
                entry={entry}
                currentAuthUserId={currentAuthUserId}
                readOnly={readOnly}
                onUpdated={handleEntryUpdated}
                onDeleted={handleEntryDeleted}
              />
            ))}
          </ul>
        ) : null}

        {readOnly && asOfDate ? (
          <p className="text-xs text-text-muted italic">
            Solo se muestran entradas hasta el {formatAsOfDisplay(asOfDate)}.
          </p>
        ) : null}

        {!readOnly ? (
          <Link
            href={actasProjectElementHistoricoPath(projectCode, elementId, { basePath })}
            className="inline-block text-xs font-medium text-icam-900 hover:text-icam-gold"
          >
            Ver histórico completo →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
