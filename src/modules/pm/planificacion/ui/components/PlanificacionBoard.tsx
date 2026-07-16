"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import type { PmHitoCatalogo, PmSnapshot } from "@/modules/pm/types";
import { shiftHitosFechas } from "@/modules/pm/planificacion/actions/crud-hito";
import { boardMinWidthPx, snapshotLabel } from "@/modules/pm/planificacion/logic/planificacion-display";

import { CongelarSnapshotDialog } from "./CongelarSnapshotDialog";
import { PlanificacionColumnHeader } from "./PlanificacionColumnHeader";
import { PlanificacionHitoRow } from "./PlanificacionHitoRow";

const STORAGE_KEY = "pm.planificacion.columnasOcultas";

interface PlanificacionBoardProps {
  rows: PmPortfolioRow[];
  catalogo: PmHitoCatalogo[];
  snapshots: PmSnapshot[];
  hasWriteAccess: boolean;
}

export function PlanificacionBoard({
  rows,
  catalogo,
  snapshots,
  hasWriteAccess,
}: PlanificacionBoardProps) {
  const router = useRouter();
  const [activoId, setActivoId] = useState<string>(rows[0]?.activo.id ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [meses, setMeses] = useState(3);
  const [soloTablaMadre, setSoloTablaMadre] = useState(false);
  const [pending, startTransition] = useTransition();

  // Ocultar columnas: preferencia LOCAL de quien edita, no toca a nadie más.
  // Distinto del check "publicar" de la cabecera, que sí es dato compartido.
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [cargado, setCargado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setOcultas(new Set(JSON.parse(raw) as string[]));
    } catch {
      // localStorage no disponible: se trabaja con todas las columnas visibles.
    }
    setCargado(true);
  }, []);

  useEffect(() => {
    if (!cargado) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ocultas]));
    } catch {
      // Sin persistencia, pero la sesión sigue funcionando.
    }
  }, [ocultas, cargado]);

  const mostrarToast = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const catalogoPorId = useMemo(() => {
    const m = new Map<string, PmHitoCatalogo>();
    for (const c of catalogo) m.set(c.id, c);
    return m;
  }, [catalogo]);

  const catalogoPorNombre = useMemo(() => {
    const m = new Map<string, PmHitoCatalogo>();
    for (const c of catalogo) m.set(c.nombre, c);
    return m;
  }, [catalogo]);

  const snapshotsVisibles = useMemo(
    () => snapshots.filter((s) => !ocultas.has(s.snapshot_code)),
    [snapshots, ocultas],
  );

  const row = rows.find((r) => r.activo.id === activoId) ?? rows[0];

  const hitos = useMemo(() => {
    if (!row) return [];
    const lista = [...row.hitos].sort((a, b) => a.orden_hito - b.orden_hito);
    if (!soloTablaMadre) return lista;
    return lista.filter((h) => {
      const cat = h.catalogo_id
        ? catalogoPorId.get(h.catalogo_id)
        : catalogoPorNombre.get(h.hito);
      return cat?.tabla_madre_existe === true;
    });
  }, [row, soloTablaMadre, catalogoPorId, catalogoPorNombre]);

  const catalogoDe = (hitoId: string, catalogoId: string | null | undefined, nombre: string) => {
    void hitoId;
    return catalogoId ? catalogoPorId.get(catalogoId) : catalogoPorNombre.get(nombre);
  };

  const toggleSeleccion = (id: string) => {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const todosSeleccionados = hitos.length > 0 && hitos.every((h) => seleccion.has(h.id));

  const toggleTodos = () => {
    setSeleccion(todosSeleccionados ? new Set() : new Set(hitos.map((h) => h.id)));
  };

  const desplazar = () => {
    if (seleccion.size === 0) return;
    startTransition(async () => {
      const r = await shiftHitosFechas({ hitoIds: [...seleccion], meses });
      if (!r.ok) {
        mostrarToast(r.error);
        return;
      }
      mostrarToast(
        `${r.movidos} ${r.movidos === 1 ? "hito desplazado" : "hitos desplazados"} ${meses > 0 ? "+" : ""}${meses} meses.`,
      );
      setSeleccion(new Set());
      router.refresh();
    });
  };

  if (!row) {
    return (
      <section className="rounded-lg border border-subtle/50 bg-card p-6 text-sm text-text-muted">
        No hay proyectos en PM.{" "}
        <a href="/dashboard/pm/proyectos" className="text-icam-900 underline">
          Crea el primero
        </a>
        .
      </section>
    );
  }

  const minWidth = boardMinWidthPx(snapshotsVisibles.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle/50 bg-card p-3">
        <label className="text-xs font-medium text-text-muted">Proyecto</label>
        <select
          value={row.activo.id}
          onChange={(e) => {
            setActivoId(e.target.value);
            setSeleccion(new Set());
          }}
          className="rounded border border-subtle bg-page px-2 py-1 text-sm text-text-body focus:outline-none focus:ring-1 focus:ring-icam-900/20"
        >
          {rows.map((r) => (
            <option key={r.activo.id} value={r.activo.id}>
              {r.activo.id_activo}
              {r.activo.nombre_display ? ` — ${r.activo.nombre_display}` : ""}
            </option>
          ))}
        </select>

        <span className="text-xs text-text-muted">{row.activo.tipo_uso_activo}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-body">
            <input
              type="checkbox"
              checked={soloTablaMadre}
              onChange={(e) => setSoloTablaMadre(e.target.checked)}
              className="h-3.5 w-3.5 accent-icam-900"
            />
            Solo hitos de Tabla madre
          </label>

          <details className="relative">
            <summary className="cursor-pointer list-none rounded border border-subtle px-2 py-1 text-xs text-text-body hover:bg-page">
              Columnas ({snapshotsVisibles.length}/{snapshots.length})
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-subtle/60 bg-card p-2 shadow-lg">
              <p className="mb-1.5 text-[10px] leading-snug text-text-muted">
                Solo afecta a tu vista. Para quitar un trimestre del Overview usa
                el check «publicar» de su columna.
              </p>
              {snapshots.map((s) => (
                <label
                  key={s.snapshot_code}
                  className="flex cursor-pointer items-center gap-1.5 py-0.5 text-xs text-text-body"
                >
                  <input
                    type="checkbox"
                    checked={!ocultas.has(s.snapshot_code)}
                    className="h-3.5 w-3.5 accent-icam-900"
                    onChange={() =>
                      setOcultas((o) => {
                        const n = new Set(o);
                        if (n.has(s.snapshot_code)) n.delete(s.snapshot_code);
                        else n.add(s.snapshot_code);
                        return n;
                      })
                    }
                  />
                  {snapshotLabel(s)}
                </label>
              ))}
            </div>
          </details>

          {hasWriteAccess ? <CongelarSnapshotDialog onDone={mostrarToast} /> : null}
        </div>
      </div>

      {hasWriteAccess && seleccion.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-icam-900/20 bg-icam-900/[0.03] px-3 py-2">
          <span className="text-xs font-medium text-text-body">
            {seleccion.size} {seleccion.size === 1 ? "hito" : "hitos"}
          </span>
          <span className="text-xs text-text-muted">· desplazar</span>
          <input
            type="number"
            value={meses}
            min={-120}
            max={120}
            onChange={(e) => setMeses(Number(e.target.value))}
            className="w-16 rounded border border-icam-900/30 bg-page px-1.5 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-icam-900/20"
          />
          <span className="text-xs text-text-muted">meses</span>
          <button
            type="button"
            disabled={pending || meses === 0}
            onClick={desplazar}
            className="rounded-md bg-icam-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-icam-800 disabled:opacity-50"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => setSeleccion(new Set())}
            className="rounded-md border border-subtle px-2.5 py-1 text-[11px] text-text-body hover:bg-page"
          >
            Cancelar
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
        <div style={{ minWidth }}>
          <PlanificacionColumnHeader
            snapshots={snapshotsVisibles}
            hasWriteAccess={hasWriteAccess}
            todosSeleccionados={todosSeleccionados}
            onToggleTodos={toggleTodos}
            onError={mostrarToast}
          />
          {hitos.map((h) => (
            <PlanificacionHitoRow
              key={h.id}
              hito={h}
              catalogo={catalogoDe(h.id, h.catalogo_id, h.hito)}
              snapshots={snapshotsVisibles}
              hasWriteAccess={hasWriteAccess}
              seleccionado={seleccion.has(h.id)}
              onToggleSeleccion={toggleSeleccion}
              onError={mostrarToast}
            />
          ))}
          {hitos.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-muted">
              {soloTablaMadre
                ? "Ningún hito de este proyecto está mapeado a la Tabla madre."
                : "Este proyecto no tiene hitos."}
            </p>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-lg border border-subtle/60 bg-card px-3 py-2 text-xs text-text-body shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
