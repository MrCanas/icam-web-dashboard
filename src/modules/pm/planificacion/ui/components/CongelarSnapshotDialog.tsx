"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import { congelarSnapshot } from "@/modules/pm/planificacion/actions/congelar-snapshot";
import {
  snapshotsConDatos,
  trimestreActual,
} from "@/modules/pm/planificacion/logic/planificacion-display";

interface CongelarSnapshotDialogProps {
  rows: PmPortfolioRow[];
  onDone: (mensaje: string) => void;
}

/**
 * Congelar el trimestre reportado.
 *
 * Sustituye a «añadir una columna de trimestre al Excel»: una columna existe
 * para un proyecto justo cuando ese proyecto tiene fechas congeladas en ella. Se
 * eligen los proyectos porque no todos se reportan cada trimestre — en los datos
 * históricos DC-15 no tiene ninguna fecha en Q4 2025 ni Q1 2026.
 */
export function CongelarSnapshotDialog({ rows, onDone }: CongelarSnapshotDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(trimestreActual());
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [pending, startTransition] = useTransition();

  const candidatos = useMemo(
    () => rows.filter((r) => !r.activo.archivado_at),
    [rows],
  );

  const [elegidos, setElegidos] = useState<Set<string>>(new Set());

  const abrir = () => {
    // Todos marcados por defecto: lo normal es reportar el portfolio entero, y
    // desmarcar es más rápido que marcar nueve.
    setElegidos(new Set(candidatos.map((r) => r.activo.id)));
    setCode(trimestreActual());
    setError(null);
    setConfirmar(false);
    setOpen(true);
  };

  const cerrar = () => {
    setOpen(false);
    setError(null);
    setConfirmar(false);
  };

  // Proyectos que ya tienen ese trimestre: volver a congelar los pisaría.
  const yaTienen = useMemo(() => {
    const set = new Set<string>();
    for (const r of candidatos) {
      if (snapshotsConDatos(r.hitos).has(code.trim().toUpperCase())) {
        set.add(r.activo.id);
      }
    }
    return set;
  }, [candidatos, code]);

  const pisados = [...elegidos].filter((id) => yaTienen.has(id)).length;

  const toggle = (id: string) => {
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const ejecutar = (sobrescribir: boolean) => {
    setError(null);
    startTransition(async () => {
      const r = await congelarSnapshot({
        snapshotCode: code,
        activoIds: [...elegidos],
        sobrescribir,
      });
      if (!r.ok) {
        setError(r.error);
        if (r.yaExiste) setConfirmar(true);
        return;
      }
      onDone(
        `${r.snapshotCode} congelado en ${elegidos.size} ${
          elegidos.size === 1 ? "proyecto" : "proyectos"
        }: ${r.fechas} fechas guardadas${r.sobrescrito ? " (se sobrescribió lo anterior)" : ""}.`,
      );
      cerrar();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="rounded-md bg-icam-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-icam-800"
      >
        Congelar trimestre
      </button>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[75] bg-black/20" onClick={cerrar} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Congelar trimestre"
        className="fixed left-1/2 top-1/2 z-[76] w-[440px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-subtle/60 bg-card p-4 shadow-xl"
      >
        <h2 className="text-sm font-semibold text-text-primary">Congelar trimestre</h2>
        <p className="mt-1 text-xs leading-snug text-text-muted">
          Guarda la previsión vigente como el reporte de este trimestre. Es lo que
          crea la columna: solo aparecerá en los proyectos que elijas aquí.
        </p>

        <label className="mt-3 block text-[11px] font-medium text-text-muted">
          Trimestre
        </label>
        <input
          type="text"
          value={code}
          autoFocus
          disabled={pending}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
            setConfirmar(false);
          }}
          placeholder="2026_Q2"
          className="mt-1 w-full rounded border border-icam-900/30 bg-page px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-icam-900/20"
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] font-medium text-text-muted">
            Proyectos ({elegidos.size}/{candidatos.length})
          </span>
          <div className="flex gap-2 text-[10px]">
            <button
              type="button"
              className="text-icam-900 hover:underline"
              onClick={() => setElegidos(new Set(candidatos.map((r) => r.activo.id)))}
            >
              Todos
            </button>
            <button
              type="button"
              className="text-text-muted hover:underline"
              onClick={() => setElegidos(new Set())}
            >
              Ninguno
            </button>
          </div>
        </div>

        <div className="mt-1 max-h-52 overflow-y-auto rounded border border-subtle/60 p-1">
          {candidatos.map((r) => {
            const sinPrevision = r.hitos.every((h) => !h.fecha_actual || h.archivado_at);
            return (
              <label
                key={r.activo.id}
                className="flex cursor-pointer items-center gap-1.5 px-1 py-0.5 text-xs text-text-body hover:bg-page"
              >
                <input
                  type="checkbox"
                  checked={elegidos.has(r.activo.id)}
                  disabled={pending}
                  className="h-3.5 w-3.5 accent-icam-900"
                  onChange={() => toggle(r.activo.id)}
                />
                <span className="truncate">{r.activo.id_activo}</span>
                {yaTienen.has(r.activo.id) ? (
                  <span
                    className="ml-auto shrink-0 rounded border border-amber-200 bg-amber-50 px-1 text-[9px] text-amber-700"
                    title="Ya tiene este trimestre congelado: se sobrescribiría"
                  >
                    ya congelado
                  </span>
                ) : null}
                {sinPrevision ? (
                  <span
                    className="ml-auto shrink-0 text-[9px] text-text-muted"
                    title="Sin previsión vigente: no se guardaría ninguna fecha"
                  >
                    sin fechas
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>

        {pisados > 0 ? (
          <p className="mt-2 text-[11px] text-amber-700">
            {pisados} {pisados === 1 ? "proyecto ya tiene" : "proyectos ya tienen"} este
            trimestre: se sobrescribirá lo reportado.
          </p>
        ) : null}

        {error ? (
          <p
            className={`mt-2 text-[11px] ${confirmar ? "text-amber-700" : "text-red-600"}`}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-md border border-subtle px-2.5 py-1 text-[11px] text-text-body hover:bg-page"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending || !code.trim() || elegidos.size === 0}
            onClick={() => ejecutar(confirmar)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 ${
              confirmar ? "bg-amber-600 hover:bg-amber-700" : "bg-icam-900 hover:bg-icam-800"
            }`}
          >
            {pending
              ? "Congelando…"
              : confirmar
                ? "Sobrescribir de todas formas"
                : `Congelar ${elegidos.size}`}
          </button>
        </div>
      </div>
    </>
  );
}
