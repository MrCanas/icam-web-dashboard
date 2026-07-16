"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import type { PmHitoCatalogo, PmSnapshot } from "@/modules/pm/types";
import { shiftHitosFechas } from "@/modules/pm/planificacion/actions/crud-hito";
import {
  boardMinWidthPx,
  columnasDisponibles,
  columnasPorDefecto,
  COLUMNAS_FIJAS,
  snapshotLabel,
  type Anchos,
  type ColumnaFijaKey,
} from "@/modules/pm/planificacion/logic/planificacion-display";

import { AnadirTrimestreDialog } from "./AnadirTrimestreDialog";
import { PlanificacionColumnHeader } from "./PlanificacionColumnHeader";
import { PlanificacionHitoRow } from "./PlanificacionHitoRow";

/**
 * Preferencias locales de cada usuario, no datos compartidos.
 *
 * Las columnas ocultas van POR PROYECTO: los trimestres con datos difieren de un
 * activo a otro, así que una lista global no significaría lo mismo en cada uno.
 * Los anchos sí son globales: las columnas fijas son las mismas en todos.
 */
const KEY_COLUMNAS = (activoId: string) => `pm.planificacion.columnas.${activoId}`;
const KEY_ANCHOS = "pm.planificacion.anchos";

interface PlanificacionBoardProps {
  rows: PmPortfolioRow[];
  catalogo: PmHitoCatalogo[];
  snapshots: PmSnapshot[];
  /** `${activoId}|${code}` retirados del Overview por la PMO. */
  retirados: string[];
  hasWriteAccess: boolean;
}

export function PlanificacionBoard({
  rows,
  catalogo,
  snapshots,
  retirados,
  hasWriteAccess,
}: PlanificacionBoardProps) {
  const router = useRouter();
  const [activoId, setActivoId] = useState<string>(rows[0]?.activo.id ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [meses, setMeses] = useState(3);
  const [soloTablaMadre, setSoloTablaMadre] = useState(false);
  const [verArchivados, setVerArchivados] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const retiradosSet = useMemo(() => new Set(retirados), [retirados]);

  const row = rows.find((r) => r.activo.id === activoId) ?? rows[0];

  const mostrarToast = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);
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

  const catalogoDe = (catalogoId: string | null | undefined, nombre: string) =>
    catalogoId ? catalogoPorId.get(catalogoId) : catalogoPorNombre.get(nombre);

  // --- Columnas: por defecto Levantamiento + el último trimestre CON datos ----
  const disponibles = useMemo(
    () => (row ? columnasDisponibles(snapshots, row.hitos) : []),
    [snapshots, row],
  );
  const porDefecto = useMemo(
    () => (row ? columnasPorDefecto(snapshots, row.hitos) : []),
    [snapshots, row],
  );

  const [visibles, setVisibles] = useState<Set<string> | null>(null);
  const [fijasOcultas, setFijasOcultas] = useState<Set<string>>(new Set());
  const [anchos, setAnchos] = useState<Anchos>({});
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY_ANCHOS);
      if (raw) setAnchos(JSON.parse(raw) as Anchos);
    } catch {
      // Sin persistencia se trabaja con los anchos por defecto.
    }
    setCargado(true);
  }, []);

  // Al cambiar de proyecto se recarga SU preferencia: si nunca tocó las columnas
  // (null) manda el cálculo por defecto, que depende de sus datos.
  useEffect(() => {
    if (!activoId) return;
    setSeleccion(new Set());
    setVerArchivados(false);
    try {
      const raw = window.localStorage.getItem(KEY_COLUMNAS(activoId));
      if (raw) {
        const p = JSON.parse(raw) as { snapshots?: string[]; fijasOcultas?: string[] };
        setVisibles(p.snapshots ? new Set(p.snapshots) : null);
        setFijasOcultas(new Set(p.fijasOcultas ?? []));
        return;
      }
    } catch {
      // Preferencia corrupta: se ignora y se usa el defecto.
    }
    setVisibles(null);
    setFijasOcultas(new Set());
  }, [activoId]);

  const guardarColumnas = useCallback(
    (snaps: Set<string> | null, fijas: Set<string>) => {
      if (!activoId) return;
      try {
        window.localStorage.setItem(
          KEY_COLUMNAS(activoId),
          JSON.stringify({
            snapshots: snaps ? [...snaps] : undefined,
            fijasOcultas: [...fijas],
          }),
        );
      } catch {
        // Sin persistencia, pero la sesión sigue.
      }
    },
    [activoId],
  );

  const onAncho = useCallback((key: string, px: number) => {
    setAnchos((a) => {
      const next = { ...a };
      if (px <= 0) delete next[key]; // doble clic → volver al defecto
      else next[key] = px;
      try {
        window.localStorage.setItem(KEY_ANCHOS, JSON.stringify(next));
      } catch {
        // idem
      }
      return next;
    });
  }, []);

  const snapshotsVisibles = useMemo(() => {
    const activos = visibles ?? new Set(porDefecto);
    return disponibles.filter((s) => activos.has(s.snapshot_code));
  }, [disponibles, visibles, porDefecto]);

  const fijasVisibles = useMemo(
    () =>
      COLUMNAS_FIJAS.filter((c) => !fijasOcultas.has(c.key)).map(
        (c) => c.key,
      ) as ColumnaFijaKey[],
    [fijasOcultas],
  );

  const toggleSnapshotCol = (code: string) => {
    const base = visibles ?? new Set(porDefecto);
    const n = new Set(base);
    if (n.has(code)) n.delete(code);
    else n.add(code);
    setVisibles(n);
    guardarColumnas(n, fijasOcultas);
  };

  const toggleFija = (key: string) => {
    const n = new Set(fijasOcultas);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    setFijasOcultas(n);
    guardarColumnas(visibles, n);
  };

  // --- Hitos: activos arriba, archivados en su apartado ----------------------
  const { activos: hitosActivos, archivados } = useMemo(() => {
    const vacio = { activos: [] as typeof hitos, archivados: [] as typeof hitos };
    const hitos = row?.hitos ?? [];
    if (!row) return vacio;

    const orden = [...hitos].sort((a, b) => a.orden_hito - b.orden_hito);
    const filtrar = (lista: typeof hitos) =>
      soloTablaMadre
        ? lista.filter(
            (h) => catalogoDe(h.catalogo_id, h.hito)?.tabla_madre_existe === true,
          )
        : lista;

    return {
      activos: filtrar(orden.filter((h) => !h.archivado_at)),
      archivados: orden.filter((h) => h.archivado_at),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, soloTablaMadre, catalogoPorId, catalogoPorNombre]);

  const toggleSeleccion = (id: string) => {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const todosSeleccionados =
    hitosActivos.length > 0 && hitosActivos.every((h) => seleccion.has(h.id));

  const toggleTodos = () => {
    setSeleccion(todosSeleccionados ? new Set() : new Set(hitosActivos.map((h) => h.id)));
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

  const minWidth = boardMinWidthPx(
    fijasVisibles,
    snapshotsVisibles.map((s) => s.snapshot_code),
    anchos,
  );
  const snapsActivos = visibles ?? new Set(porDefecto);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle/50 bg-card p-3">
        <label className="text-xs font-medium text-text-muted">Proyecto</label>
        <select
          value={row.activo.id}
          onChange={(e) => setActivoId(e.target.value)}
          className="rounded border border-subtle bg-page px-2 py-1 text-sm text-text-body focus:outline-none focus:ring-1 focus:ring-icam-900/20"
        >
          {rows.map((r) => (
            <option key={r.activo.id} value={r.activo.id}>
              {r.activo.id_activo}
              {r.activo.nombre_display ? ` — ${r.activo.nombre_display}` : ""}
              {r.activo.archivado_at ? " (archivado)" : ""}
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
              Columnas ({fijasVisibles.length + snapshotsVisibles.length})
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-subtle/60 bg-card p-2 shadow-lg">
              <p className="mb-1.5 text-[10px] leading-snug text-text-muted">
                Solo afecta a tu vista y a este proyecto. Para retirar un trimestre
                del Overview usa el check «publicar» de su columna.
              </p>

              {COLUMNAS_FIJAS.map((c) => (
                <label
                  key={c.key}
                  className={`flex items-center gap-1.5 py-0.5 text-xs ${
                    c.ocultable ? "cursor-pointer text-text-body" : "cursor-default text-text-muted"
                  }`}
                  title={c.ocultable ? undefined : "Esta columna no se puede ocultar"}
                >
                  <input
                    type="checkbox"
                    checked={!fijasOcultas.has(c.key)}
                    disabled={!c.ocultable}
                    className="h-3.5 w-3.5 accent-icam-900 disabled:opacity-40"
                    onChange={() => toggleFija(c.key)}
                  />
                  {c.label}
                </label>
              ))}

              {disponibles.length ? (
                <div className="mt-1.5 border-t border-subtle/40 pt-1.5">
                  {disponibles.map((s) => (
                    <label
                      key={s.snapshot_code}
                      className="flex cursor-pointer items-center gap-1.5 py-0.5 text-xs text-text-body"
                    >
                      <input
                        type="checkbox"
                        checked={snapsActivos.has(s.snapshot_code)}
                        className="h-3.5 w-3.5 accent-icam-900"
                        onChange={() => toggleSnapshotCol(s.snapshot_code)}
                      />
                      {snapshotLabel(s)}
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 border-t border-subtle/40 pt-1.5 text-[10px] text-text-muted">
                  Este proyecto no tiene ningún trimestre añadido todavía.
                </p>
              )}
            </div>
          </details>

          {hasWriteAccess ? (
            <AnadirTrimestreDialog rows={rows} onDone={mostrarToast} />
          ) : null}
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
            activoId={row.activo.id}
            fijasVisibles={fijasVisibles}
            snapshots={snapshotsVisibles}
            retirados={retiradosSet}
            anchos={anchos}
            hasWriteAccess={hasWriteAccess}
            todosSeleccionados={todosSeleccionados}
            onToggleTodos={toggleTodos}
            onAncho={onAncho}
            onError={mostrarToast}
          />

          {hitosActivos.map((h) => (
            <PlanificacionHitoRow
              key={h.id}
              hito={h}
              catalogo={catalogoDe(h.catalogo_id, h.hito)}
              fijasVisibles={fijasVisibles}
              snapshots={snapshotsVisibles}
              anchos={anchos}
              retirados={retiradosSet}
              hasWriteAccess={hasWriteAccess}
              seleccionado={seleccion.has(h.id)}
              onToggleSeleccion={toggleSeleccion}
              onError={mostrarToast}
              onArchivado={mostrarToast}
            />
          ))}

          {hitosActivos.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-muted">
              {soloTablaMadre
                ? "Ningún hito activo de este proyecto está mapeado a la Tabla madre."
                : "Este proyecto no tiene hitos activos."}
            </p>
          ) : null}

          {archivados.length > 0 ? (
            <div className="border-t-2 border-subtle">
              <button
                type="button"
                onClick={() => setVerArchivados((v) => !v)}
                className="flex w-full items-center gap-2 bg-subtle/30 px-3 py-2 text-left text-xs font-semibold text-text-muted hover:bg-subtle/50"
              >
                <span className="text-[10px]">{verArchivados ? "▾" : "▸"}</span>
                Archivados ({archivados.length})
                <span className="font-normal">
                  · no aplican a este proyecto; fuera del Gantt y del detalle
                </span>
              </button>
              {verArchivados
                ? archivados.map((h) => (
                    <PlanificacionHitoRow
                      key={h.id}
                      hito={h}
                      catalogo={catalogoDe(h.catalogo_id, h.hito)}
                      fijasVisibles={fijasVisibles}
                      snapshots={snapshotsVisibles}
                      anchos={anchos}
                      retirados={retiradosSet}
                      hasWriteAccess={hasWriteAccess}
                      seleccionado={false}
                      onToggleSeleccion={() => {}}
                      onError={mostrarToast}
                      onArchivado={mostrarToast}
                    />
                  ))
                : null}
            </div>
          ) : null}
        </div>
      </div>

      {!cargado ? null : null}

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
