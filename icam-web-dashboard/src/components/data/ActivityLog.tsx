"use client";

import { ActivityLogDetail } from "@/components/data/ActivityLogDetail";
import { Fragment, useEffect, useState } from "react";

interface UploadLogRow {
  id: number;
  fecha: string;
  usuario: string;
  archivo: string;
  num_proyectos: number | null;
  estado: string;
  duracion_ms: number | null;
  detalle: unknown;
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function estadoBadge(estado: string) {
  const e = estado.toLowerCase();
  if (e.includes("complet") || e === "ok") {
    return "bg-green-100 text-green-800";
  }
  if (e.includes("error") || e.includes("fall")) {
    return "bg-red-100 text-red-800";
  }
  if (e.includes("proceso")) {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-subtle text-text-body";
}

export function ActivityLog() {
  const [logs, setLogs] = useState<UploadLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/upload-logs", { credentials: "same-origin" });
        const json = (await res.json()) as { logs?: UploadLogRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "No se pudieron cargar los registros");
          setLogs([]);
          return;
        }
        setLogs(json.logs ?? []);
      } catch {
        if (!cancelled) {
          setError("Error de red");
          setLogs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/upload-logs", { credentials: "same-origin" });
      const json = (await res.json()) as { logs?: UploadLogRow[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? "No se pudieron cargar los registros");
        setLogs([]);
        return;
      }
      setLogs(json.logs ?? []);
    } catch {
      setError("Error de red");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card rounded-lg border border-subtle p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-icam-900">Historial de subidas</h2>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-subtle px-3 py-1.5 text-sm text-icam-900 hover:bg-subtle/80"
        >
          Actualizar
        </button>
      </div>

      {loading ? <p className="mt-4 text-sm text-text-muted">Cargando…</p> : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && logs.length === 0 ? (
        <p className="mt-4 text-sm text-text-muted">Aún no hay subidas registradas.</p>
      ) : null}

      {!loading && logs.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="border-b border-subtle text-xs uppercase text-text-muted">
              <tr>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 pr-3">Archivo</th>
                <th className="py-2 pr-3">Nº</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Duración</th>
                <th className="py-2 pr-3">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-t border-subtle">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(row.fecha)}</td>
                    <td className="py-2 pr-3">{row.usuario}</td>
                    <td className="py-2 pr-3 max-w-[180px] truncate" title={row.archivo}>
                      {row.archivo}
                    </td>
                    <td className="py-2 pr-3">{row.num_proyectos ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${estadoBadge(row.estado)}`}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {row.duracion_ms != null ? `${(row.duracion_ms / 1000).toFixed(1)} s` : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="text-icam-gold hover:underline"
                        onClick={() => setExpanded((x) => (x === row.id ? null : row.id))}
                      >
                        {expanded === row.id ? "Ocultar" : "Ver"}
                      </button>
                    </td>
                  </tr>
                  {expanded === row.id ? (
                    <tr className="bg-page">
                      <td colSpan={7} className="px-2 py-3 text-text-body">
                        <ActivityLogDetail detalle={row.detalle} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
