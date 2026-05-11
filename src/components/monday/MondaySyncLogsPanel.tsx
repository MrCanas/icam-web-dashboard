"use client";

import { useEffect, useMemo, useState } from "react";
import { Fragment } from "react";

interface SyncBoardDetail {
  id: string;
  nombre: string;
  items: number;
  estado: string;
}

interface SyncErrorDetail {
  board: string;
  mensaje: string;
  timestamp: string;
}

interface SyncDetalle {
  boards?: SyncBoardDetail[];
  errores?: SyncErrorDetail[];
  duracion_por_board_ms?: Record<string, number>;
}

interface SyncLog {
  id: string;
  fecha?: string | null;
  created_at?: string | null;
  estado: string;
  boards_sincronizados: number;
  items_sincronizados: number;
  errores: number;
  duracion_ms: number;
  detalle?: SyncDetalle | null;
}

interface SyncSummary {
  latest: SyncLog | null;
  successRate: number;
  averageFrequencyDays: number;
}

interface MondaySyncLogsPanelProps {
  initialLogs: SyncLog[];
  initialSummary: SyncSummary;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function fmtPercent(value: number) {
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * 100)}%`;
}

function fmtSeconds(ms: number) {
  return `${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ms / 1000)} s`;
}

function statusBadge(estado: string) {
  if (estado === "completado") return "bg-[#22C55E]/15 text-[#22C55E]";
  if (estado === "completado_con_errores") return "bg-[#B89660]/15 text-[#B89660]";
  if (estado === "en_proceso") return "bg-[#B89660]/15 text-[#B89660]";
  return "bg-[#EF4444]/15 text-[#EF4444]";
}

export function MondaySyncLogsPanel({ initialLogs, initialSummary }: MondaySyncLogsPanelProps) {
  const [logs, setLogs] = useState<SyncLog[]>(initialLogs);
  const [summary, setSummary] = useState<SyncSummary>(initialSummary);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refreshLogs() {
    const response = await fetch("/api/monday/sync-logs?limit=200", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { logs?: SyncLog[]; summary?: SyncSummary };
    setLogs(payload.logs ?? []);
    if (payload.summary) setSummary(payload.summary);
  }

  const hasInProgress = useMemo(() => logs.some((log) => log.estado === "en_proceso"), [logs]);

  useEffect(() => {
    if (!hasInProgress) return;
    const id = setInterval(() => {
      void refreshLogs();
    }, 3000);
    return () => clearInterval(id);
  }, [hasInProgress]);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Última sincronización</p>
          <p className="mt-2 text-sm font-medium text-text-primary">
            {fmtDate(summary.latest?.fecha ?? summary.latest?.created_at)}
          </p>
          {summary.latest ? (
            <span className={`mt-2 inline-flex rounded px-2 py-1 text-xs ${statusBadge(summary.latest.estado)}`}>
              {summary.latest.estado}
            </span>
          ) : null}
        </article>

        <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Tasa de éxito (30)</p>
          <p className="mt-2 text-sm font-medium text-text-primary">{fmtPercent(summary.successRate)}</p>
        </article>

        <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
          <p className="text-xs uppercase tracking-wide text-text-muted">Frecuencia media</p>
          <p className="mt-2 text-sm font-medium text-text-primary">
            cada {new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(summary.averageFrequencyDays)} días
          </p>
        </article>
      </div>

      <article className="bg-card rounded-lg border border-subtle/50 shadow-sm p-3 sm:p-4">
        <h2 className="text-base font-semibold text-icam-900 mb-3">Historial de sincronizaciones</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-subtle text-left text-text-muted">
                <th className="py-2 pr-4 font-medium">Fecha</th>
                <th className="py-2 pr-4 font-medium">Estado</th>
                <th className="py-2 pr-4 font-medium">Boards</th>
                <th className="py-2 pr-4 font-medium">Items</th>
                <th className="py-2 pr-4 font-medium">Errores</th>
                <th className="py-2 pr-4 font-medium">Duración</th>
                <th className="py-2 pr-4 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const isOpen = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr key={log.id} className="border-b border-subtle/70">
                      <td className="py-2 pr-4 text-text-body">{fmtDate(log.fecha ?? log.created_at)}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex rounded px-2 py-1 text-xs ${statusBadge(log.estado)}`}>
                          {log.estado}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-text-body">{log.boards_sincronizados}</td>
                      <td className="py-2 pr-4 text-text-body">{log.items_sincronizados}</td>
                      <td className={`py-2 pr-4 ${log.errores > 0 ? "text-[#EF4444]" : "text-[#22C55E]"}`}>
                        {log.errores}
                      </td>
                      <td className="py-2 pr-4 text-text-body">{fmtSeconds(log.duracion_ms ?? 0)}</td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          className="text-icam-900 hover:underline"
                          onClick={() => setExpandedId(isOpen ? null : log.id)}
                        >
                          {isOpen ? "Ocultar" : "Ver"}
                        </button>
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="border-b border-subtle/70 bg-page/40">
                        <td colSpan={7} className="py-3 px-2">
                          <div className="space-y-2 text-xs text-text-body">
                            <p className="font-medium text-text-primary">Boards</p>
                            <ul className="space-y-1">
                              {(log.detalle?.boards ?? []).map((board) => (
                                <li key={`${log.id}-${board.id}`}>
                                  {board.nombre} ({board.id}) · {board.items} items · {board.estado}
                                </li>
                              ))}
                            </ul>
                            <p className="font-medium text-text-primary">Errores</p>
                            <ul className="space-y-1">
                              {(log.detalle?.errores ?? []).length === 0 ? (
                                <li>Sin errores</li>
                              ) : (
                                (log.detalle?.errores ?? []).map((err, idx) => (
                                  <li key={`${log.id}-err-${idx}`}>
                                    [{fmtDate(err.timestamp)}] {err.board}: {err.mensaje}
                                  </li>
                                ))
                              )}
                            </ul>
                            <p className="font-medium text-text-primary">Duración por board</p>
                            <ul className="space-y-1">
                              {Object.entries(log.detalle?.duracion_por_board_ms ?? {}).map(([boardId, ms]) => (
                                <li key={`${log.id}-dur-${boardId}`}>
                                  {boardId}: {fmtSeconds(Number(ms))}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

