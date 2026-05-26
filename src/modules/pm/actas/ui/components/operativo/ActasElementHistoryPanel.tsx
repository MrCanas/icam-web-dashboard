"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { actasProjectElementHistoricoPath } from "@/modules/pm/actas/logic/actas-paths";
import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";
import { formatLogEntryDate } from "@/modules/pm/actas/logic/actas-time";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

import { ActasLogEntryStatusChip } from "./ActasLogEntryStatusChip";

interface ActasElementHistoryPanelProps {
  elementId: string;
  elementName: string;
  projectCode: string;
  indentPx: number;
}

export function ActasElementHistoryPanel({
  elementId,
  elementName,
  projectCode,
  indentPx,
}: ActasElementHistoryPanelProps) {
  const [entries, setEntries] = useState<ActasLogEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/actas/elements/${encodeURIComponent(elementId)}/log-entries`,
      );
      const body = (await res.json()) as {
        entries?: ActasLogEntryItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setEntries(body.entries ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error de carga");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [elementId]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const visible = showDeleted
    ? entries
    : entries.filter((e) => e.deletedAt == null);
  const deletedCount = entries.filter((e) => e.deletedAt != null).length;

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
          {deletedCount > 0 ? (
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
            {entries.length > 0 && !showDeleted
              ? "Solo hay entradas borradas. Activa «Mostrar borradas»."
              : "Sin entradas en el histórico."}
          </p>
        ) : null}

        {!loading && !loadError && visible.length > 0 ? (
          <ul className="space-y-3">
            {visible.map((entry) => {
              const hasStatusChange =
                entry.statusBefore != null && entry.statusAfter != null;
              const isDeleted = entry.deletedAt != null;

              return (
                <li
                  key={entry.id}
                  className={`rounded-md border border-subtle/60 bg-card p-3 ${
                    isDeleted ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-medium text-text-primary">
                      {entry.author?.email ?? entry.author?.label ?? "Sin autor"}
                    </span>
                    <span className="text-text-muted">
                      {formatLogEntryDate(entry.entryDate)}
                    </span>
                    {isDeleted ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                        Borrada
                      </span>
                    ) : null}
                    {hasStatusChange ? (
                      <ActasLogEntryStatusChip
                        statusBefore={entry.statusBefore!}
                        statusAfter={entry.statusAfter!}
                      />
                    ) : null}
                  </div>
                  <p
                    className={`mt-2 text-sm text-text-body whitespace-pre-wrap break-words ${
                      isDeleted ? "line-through" : ""
                    }`}
                  >
                    {entry.content}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : null}

        <Link
          href={actasProjectElementHistoricoPath(projectCode, elementId)}
          className="inline-block text-xs font-medium text-icam-900 hover:text-icam-gold"
        >
          Ver histórico completo →
        </Link>
      </div>
    </div>
  );
}
