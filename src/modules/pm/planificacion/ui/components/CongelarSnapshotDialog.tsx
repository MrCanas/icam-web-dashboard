"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { congelarSnapshot } from "@/modules/pm/planificacion/actions/congelar-snapshot";
import { trimestreActual } from "@/modules/pm/planificacion/logic/planificacion-display";

interface CongelarSnapshotDialogProps {
  onDone: (mensaje: string) => void;
}

/**
 * Congelar el trimestre reportado.
 *
 * Es lo que sustituye a "añadir una columna de trimestre al Excel": copia la
 * previsión vigente de todos los hitos a un snapshot con nombre. Global al
 * portfolio, porque un reporte trimestral cubre todos los proyectos.
 *
 * Si el trimestre ya estaba congelado, la acción lo detecta y devuelve
 * `yaExiste`; aquí se pide confirmación antes de pisar el reporte anterior.
 */
export function CongelarSnapshotDialog({ onDone }: CongelarSnapshotDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(trimestreActual());
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [pending, startTransition] = useTransition();

  const cerrar = () => {
    setOpen(false);
    setError(null);
    setConfirmar(false);
    setCode(trimestreActual());
  };

  const ejecutar = (sobrescribir: boolean) => {
    setError(null);
    startTransition(async () => {
      const r = await congelarSnapshot({ snapshotCode: code, sobrescribir });
      if (!r.ok) {
        setError(r.error);
        if (r.yaExiste) setConfirmar(true);
        return;
      }
      onDone(
        `${r.snapshotCode} congelado: ${r.fechas} fechas guardadas${r.sobrescrito ? " (reporte anterior sobrescrito)" : ""}.`,
      );
      cerrar();
      router.refresh();
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
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
        className="fixed left-1/2 top-1/2 z-[76] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-subtle/60 bg-card p-4 shadow-xl"
      >
        <h2 className="text-sm font-semibold text-text-primary">Congelar trimestre</h2>
        <p className="mt-1 text-xs leading-snug text-text-muted">
          Guarda la previsión vigente de todos los proyectos como el reporte de
          este trimestre. A partir de ahí podrás seguir editando las previsiones
          sin perder lo reportado.
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

        {error ? (
          <p className={`mt-2 text-[11px] ${confirmar ? "text-amber-700" : "text-red-600"}`} role="alert">
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
            disabled={pending || !code.trim()}
            onClick={() => ejecutar(confirmar)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50 ${
              confirmar ? "bg-amber-600 hover:bg-amber-700" : "bg-icam-900 hover:bg-icam-800"
            }`}
          >
            {pending ? "Congelando…" : confirmar ? "Sobrescribir de todas formas" : "Congelar"}
          </button>
        </div>
      </div>
    </>
  );
}
