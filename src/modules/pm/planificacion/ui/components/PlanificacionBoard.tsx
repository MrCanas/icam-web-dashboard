"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import type { PmHitoCatalogo, PmSnapshot } from "@/modules/pm/types";
import { shiftHitosFechas } from "@/modules/pm/planificacion/actions/crud-hito";
import { bulkUpdateFechas } from "@/modules/pm/planificacion/actions/bulk-update-fechas";
import {
  mapPasteAFilas,
  parseClipboardFechas,
} from "@/modules/pm/planificacion/logic/planificacion-paste";
import {
  evaluarGatePublicacion,
  sujetoAValidacion,
  type GatePublicacion,
} from "@/modules/pm/planificacion/logic/publicacion-gate";
import {
  contarPendientes,
  type ResolucionFoto,
} from "@/modules/pm/planificacion/logic/discrepancias";
import type { MaestroHitoFechaRow, PmSnapshotValidacion } from "@/modules/pm/types";
import {
  boardMinWidthPx,
  colKeyDe,
  columnasDisponibles,
  columnasPorDefecto,
  COLUMNAS_FIJAS,
  snapshotLabel,
  type Anchos,
  type ColumnaFijaKey,
  type ColumnaSnapshotArea,
} from "@/modules/pm/planificacion/logic/planificacion-display";

import { AnadirTrimestreDialog } from "./AnadirTrimestreDialog";
import { PegarFechasDialog } from "./PegarFechasDialog";
import { PlanificacionColumnHeader } from "./PlanificacionColumnHeader";
import { PlanificacionHitoRow } from "./PlanificacionHitoRow";
import type { FechaCellTarget } from "./PlanificacionFechaCell";

/** Fechas pegadas aún no confirmadas por el servidor, por hito. */
type PasteOverride = { prevision?: string | null; snapshots?: Record<string, string | null> };

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
  /** pm_activo_id → proyecto_financiero_key (gate de publicación). */
  mapeo: Record<string, string>;
  /** Líneas reportadas en el maestro: `${proyecto}|${trimestre_code}`. */
  lineasMaestro: string[];
  /** Fechas de hito de las líneas del maestro. */
  fechasMaestro: MaestroHitoFechaRow[];
  /** Resoluciones de discrepancias (migración 026). */
  resoluciones: PmSnapshotValidacion[];
  /** false = migraciones 024-026 sin aplicar: gate inactivo, sin columnas Maestro. */
  maestroDisponible: boolean;
  hasWriteAccess: boolean;
  /**
   * Fija el board a un proyecto (pm_activos.id) y sustituye el selector por un
   * literal. Lo usa la vista anidada /dashboard/pm/proyecto/[id]/planificacion,
   * donde el proyecto ya viene dado por la navegación.
   */
  activoFijoId?: string;
}

export function PlanificacionBoard({
  rows,
  catalogo,
  snapshots,
  retirados,
  mapeo,
  lineasMaestro,
  fechasMaestro,
  resoluciones,
  maestroDisponible,
  hasWriteAccess,
  activoFijoId,
}: PlanificacionBoardProps) {
  const router = useRouter();
  const [activoId, setActivoId] = useState<string>(
    activoFijoId ?? rows[0]?.activo.id ?? "",
  );
  const [toast, setToast] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [meses, setMeses] = useState(3);
  const [soloTablaMadre, setSoloTablaMadre] = useState(false);
  const [verArchivados, setVerArchivados] = useState(false);
  const [pending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Map<string, PasteOverride> | null>(null);
  const [pendingPaste, startPaste] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // El override optimista vive hasta que el refresh del pegado termina (la
  // transición acaba con los datos nuevos ya en pantalla). Ajuste durante el
  // render, sin efecto, como la resincronización de PlanificacionHitoRow.
  if (overrides && !pendingPaste) setOverrides(null);

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

  // --- Maestro y gate de publicación para el activo abierto ------------------
  const proyectoFinanciero = row ? (mapeo[row.activo.id] ?? null) : null;
  const lineasSet = useMemo(() => new Set(lineasMaestro), [lineasMaestro]);

  // Columnas del área de snapshots: cada trimestre visible y, si el Financiero
  // ya reportó su línea, la columna «Maestro» pegada a él.
  const columnasArea = useMemo<ColumnaSnapshotArea[]>(() => {
    const out: ColumnaSnapshotArea[] = [];
    for (const s of snapshotsVisibles) {
      out.push({ tipo: "snapshot", snap: s });
      // Solo los trimestres sujetos al flujo (desde el corte) comparan con el
      // maestro: los anteriores son historia consolidada y no se tocan.
      if (
        proyectoFinanciero &&
        sujetoAValidacion(s.snapshot_code) &&
        lineasSet.has(`${proyectoFinanciero}|${s.snapshot_code}`)
      ) {
        out.push({ tipo: "maestro", snap: s });
      }
    }
    return out;
  }, [snapshotsVisibles, proyectoFinanciero, lineasSet]);

  // Fechas del maestro del proyecto financiero abierto: code → (columna → fecha).
  const fechasMaestroPorCode = useMemo(() => {
    const out = new Map<string, Map<string, string | null>>();
    if (!proyectoFinanciero) return out;
    for (const f of fechasMaestro) {
      if (f.proyecto !== proyectoFinanciero) continue;
      let porColumna = out.get(f.trimestre_code);
      if (!porColumna) {
        porColumna = new Map();
        out.set(f.trimestre_code, porColumna);
      }
      porColumna.set(f.columna.trim().toLowerCase(), f.fecha);
    }
    return out;
  }, [fechasMaestro, proyectoFinanciero]);

  const resolucionesPorClave = useMemo(() => {
    const out = new Map<string, ResolucionFoto>();
    for (const r of resoluciones) {
      out.set(`${r.hito_id}|${r.snapshot_code}`, {
        fecha_elegida: r.fecha_elegida,
        fecha_maestro: r.fecha_maestro,
      });
    }
    return out;
  }, [resoluciones]);

  // Pendientes por trimestre del activo abierto: sobre TODOS sus hitos no
  // archivados, no solo los filtrados en la vista — el gate no depende de cómo
  // esté filtrada la rejilla.
  const pendientesPorCode = useMemo(() => {
    const out: Record<string, number> = {};
    if (!row) return out;
    const hitosNoArchivados = row.hitos.filter((h) => !h.archivado_at);
    for (const col of columnasArea) {
      if (col.tipo !== "maestro") continue;
      const code = col.snap.snapshot_code;
      const linea = fechasMaestroPorCode.get(code);
      if (!linea) continue;
      const resMap = new Map<string, ResolucionFoto>();
      for (const h of hitosNoArchivados) {
        const r = resolucionesPorClave.get(`${h.id}|${code}`);
        if (r) resMap.set(h.id, r);
      }
      out[code] = contarPendientes(
        hitosNoArchivados.map((h) => ({
          id: h.id,
          catalogoColumna:
            catalogoDe(h.catalogo_id, h.hito)?.tabla_madre_columna ?? null,
          fechaOficial: h.snapshots[code] ?? null,
        })),
        [...linea.entries()].map(([columna, fecha]) => ({ columna, fecha })),
        resMap,
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row, columnasArea, fechasMaestroPorCode, resolucionesPorClave, catalogoPorId, catalogoPorNombre]);

  const gates = useMemo(() => {
    const out: Record<string, GatePublicacion> = {};
    for (const s of snapshotsVisibles) {
      // Sin las migraciones del maestro el gate no existe: publicar funciona
      // como siempre. El flujo de validación aplica a partir de que existan.
      out[s.snapshot_code] = !maestroDisponible
        ? { permitido: true }
        : evaluarGatePublicacion({
            snapshotCode: s.snapshot_code,
            proyectoFinanciero,
            lineaMaestroExiste: proyectoFinanciero
              ? lineasSet.has(`${proyectoFinanciero}|${s.snapshot_code}`)
              : false,
            discrepanciasPendientes: pendientesPorCode[s.snapshot_code] ?? 0,
          });
    }
    return out;
  }, [snapshotsVisibles, proyectoFinanciero, lineasSet, pendientesPorCode, maestroDisponible]);

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

  // --- Pegado en columna: la celda con foco es el ancla ----------------------
  const hitosActivosRender = useMemo(() => {
    if (!overrides) return hitosActivos;
    return hitosActivos.map((h) => {
      const o = overrides.get(h.id);
      if (!o) return h;
      return {
        ...h,
        fecha_actual: o.prevision !== undefined ? o.prevision : h.fecha_actual,
        snapshots: o.snapshots ? { ...h.snapshots, ...o.snapshots } : h.snapshots,
      };
    });
  }, [hitosActivos, overrides]);

  const pegarColumna = (hitoIdAncla: string, target: FechaCellTarget, texto: string) => {
    const parsed = parseClipboardFechas(texto);
    if (parsed.errores.length > 0) {
      const e = parsed.errores[0];
      mostrarToast(`No se ha pegado nada — línea ${e.linea}: ${e.motivo}`);
      return;
    }
    if (parsed.fechas.length === 0) return;

    const items = mapPasteAFilas(
      hitoIdAncla,
      hitosActivos.map((h) => h.id),
      parsed.fechas,
    );
    if (items.length === 0) return;

    // Optimista: se pinta ya y el servidor confirma con el refresh.
    const siguientes = new Map<string, PasteOverride>();
    for (const it of items) {
      if (target.tipo === "prevision") {
        siguientes.set(it.hitoId, { prevision: it.fecha });
      } else {
        siguientes.set(it.hitoId, { snapshots: { [target.snapshotCode]: it.fecha } });
      }
    }
    setOverrides(siguientes);

    const avisos: string[] = [];
    if (parsed.multiColumna) avisos.push("solo se ha usado la primera columna");
    if (parsed.truncado) avisos.push("recortado por el límite de líneas");

    startPaste(async () => {
      const r = await bulkUpdateFechas({
        target:
          target.tipo === "snapshot"
            ? { tipo: "snapshot", snapshotCode: target.snapshotCode }
            : { tipo: "prevision" },
        items,
      });
      if (!r.ok) {
        setOverrides(null); // rollback
        mostrarToast(r.error);
        return;
      }
      const destino = target.tipo === "snapshot" ? target.label : "Previsión";
      mostrarToast(
        `${r.actualizados} ${r.actualizados === 1 ? "fecha pegada" : "fechas pegadas"} en ${destino}.` +
          (avisos.length ? ` (${avisos.join("; ")})` : ""),
      );
      router.refresh();
    });
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

  const minWidth = boardMinWidthPx(fijasVisibles, columnasArea.map(colKeyDe), anchos);
  const snapsActivos = visibles ?? new Set(porDefecto);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-subtle/50 bg-card p-3">
        <label className="text-xs font-medium text-text-muted">Proyecto</label>
        {activoFijoId ? (
          <span className="text-sm font-medium text-text-body">
            {row.activo.id_activo}
            {row.activo.nombre_display ? ` — ${row.activo.nombre_display}` : ""}
            {row.activo.archivado_at ? " (archivado)" : ""}
          </span>
        ) : (
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
        )}

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
            <PegarFechasDialog
              hitos={hitosActivos.map((h) => ({ id: h.id, nombre: h.hito }))}
              destinos={[
                { target: { tipo: "prevision" }, etiqueta: "Previsión (fecha vigente)" },
                ...snapshotsVisibles.map((s) => ({
                  target: {
                    tipo: "snapshot" as const,
                    snapshotCode: s.snapshot_code,
                    label: snapshotLabel(s),
                  },
                  etiqueta: snapshotLabel(s),
                })),
              ]}
              onAplicar={pegarColumna}
            />
          ) : null}

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
            columnas={columnasArea}
            retirados={retiradosSet}
            gates={gates}
            pendientesPorCode={pendientesPorCode}
            proyectoFinanciero={proyectoFinanciero}
            anchos={anchos}
            hasWriteAccess={hasWriteAccess}
            todosSeleccionados={todosSeleccionados}
            onToggleTodos={toggleTodos}
            onAncho={onAncho}
            onError={mostrarToast}
          />

          {hitosActivosRender.map((h) => (
            <PlanificacionHitoRow
              key={h.id}
              hito={h}
              catalogo={catalogoDe(h.catalogo_id, h.hito)}
              fijasVisibles={fijasVisibles}
              columnas={columnasArea}
              fechasMaestroPorCode={fechasMaestroPorCode}
              resoluciones={resolucionesPorClave}
              anchos={anchos}
              retirados={retiradosSet}
              hasWriteAccess={hasWriteAccess}
              seleccionado={seleccion.has(h.id)}
              onToggleSeleccion={toggleSeleccion}
              onError={mostrarToast}
              onArchivado={mostrarToast}
              onToast={mostrarToast}
              onPasteColumna={hasWriteAccess ? pegarColumna : undefined}
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
                      columnas={columnasArea}
                      fechasMaestroPorCode={fechasMaestroPorCode}
                      resoluciones={resolucionesPorClave}
                      anchos={anchos}
                      retirados={retiradosSet}
                      hasWriteAccess={hasWriteAccess}
                      seleccionado={false}
                      onToggleSeleccion={() => {}}
                      onError={mostrarToast}
                      onArchivado={mostrarToast}
                      onToast={mostrarToast}
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
