"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { PmSnapshot } from "@/modules/pm/types";
import { toggleSnapshotPublicado } from "@/modules/pm/planificacion/actions/toggle-snapshot-publicado";
import {
  anchoMinimoDe,
  COLUMNAS_FIJAS,
  GRID_BASE_CLASS,
  planificacionGridTemplate,
  snapshotLabel,
  type Anchos,
  type ColumnaFijaKey,
} from "@/modules/pm/planificacion/logic/planificacion-display";

const TH = "text-[10px] font-semibold uppercase tracking-wide text-text-muted";

interface PlanificacionColumnHeaderProps {
  activoId: string;
  fijasVisibles: ColumnaFijaKey[];
  snapshots: PmSnapshot[];
  retirados: Set<string>;
  anchos: Anchos;
  hasWriteAccess: boolean;
  todosSeleccionados: boolean;
  onToggleTodos: () => void;
  onAncho: (key: string, px: number) => void;
  onError: (message: string) => void;
}

/**
 * Cabecera de la rejilla.
 *
 * El check «publicar» es POR PROYECTO: publica o retira ese trimestre solo en el
 * activo abierto. Antes era global y no podía serlo — los proyectos ni empiezan
 * a la vez ni se reportan todos cada trimestre.
 *
 * No confundir con ocultar la columna (menú de arriba): publicar es un dato que
 * ven todos, ocultar es comodidad de quien edita.
 */
export function PlanificacionColumnHeader({
  activoId,
  fijasVisibles,
  snapshots,
  retirados,
  anchos,
  hasWriteAccess,
  todosSeleccionados,
  onToggleTodos,
  onAncho,
  onError,
}: PlanificacionColumnHeaderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimista, setOptimista] = useState<Record<string, boolean>>({});

  const publicado = (code: string) =>
    optimista[code] ?? !retirados.has(`${activoId}|${code}`);

  // El optimista es por proyecto: al cambiar de activo hay que soltarlo o se
  // arrastraría el estado del anterior.
  useEffect(() => setOptimista({}), [activoId]);

  const togglePublicar = (code: string) => {
    const siguiente = !publicado(code);
    setOptimista((o) => ({ ...o, [code]: siguiente }));
    startTransition(async () => {
      const r = await toggleSnapshotPublicado({
        activoId,
        snapshotCode: code,
        publicado: siguiente,
      });
      if (!r.ok) {
        setOptimista((o) => ({ ...o, [code]: !siguiente }));
        onError(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={`sticky top-0 z-10 ${GRID_BASE_CLASS} border-b border-subtle/60 bg-page/95 px-3 py-1.5 backdrop-blur`}
      style={{
        gridTemplateColumns: planificacionGridTemplate(
          fijasVisibles,
          snapshots.map((s) => s.snapshot_code),
          anchos,
        ),
      }}
    >
      <input
        type="checkbox"
        checked={todosSeleccionados}
        disabled={!hasWriteAccess}
        aria-label="Seleccionar todos los hitos"
        className="h-3.5 w-3.5 accent-icam-900 disabled:opacity-40"
        onChange={onToggleTodos}
      />

      {fijasVisibles.map((key) => {
        const col = COLUMNAS_FIJAS.find((c) => c.key === key)!;
        return (
          <Redimensionable key={key} colKey={key} anchos={anchos} onAncho={onAncho}>
            <span className={`${TH} truncate`}>{col.label}</span>
          </Redimensionable>
        );
      })}

      {snapshots.map((s) => (
        <Redimensionable
          key={s.snapshot_code}
          colKey={s.snapshot_code}
          anchos={anchos}
          onAncho={onAncho}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={`${TH} truncate`} title={s.snapshot_code}>
              {snapshotLabel(s)}
            </span>
            <label
              className={`flex cursor-pointer items-center gap-1 text-[9px] ${
                publicado(s.snapshot_code) ? "text-icam-900" : "text-text-muted"
              } ${hasWriteAccess ? "" : "cursor-default opacity-60"}`}
              title={
                publicado(s.snapshot_code)
                  ? "Este proyecto publica el trimestre en el Overview. Desmárcalo para retirarlo solo aquí (no borra fechas)."
                  : "Retirado del Overview en este proyecto. Las fechas siguen guardadas."
              }
            >
              <input
                type="checkbox"
                checked={publicado(s.snapshot_code)}
                disabled={!hasWriteAccess || pending}
                className="h-2.5 w-2.5 accent-icam-900"
                onChange={() => togglePublicar(s.snapshot_code)}
              />
              publicar
            </label>
          </div>
        </Redimensionable>
      ))}
    </div>
  );
}

/**
 * Envuelve una cabecera y le añade el tirador de redimensionado.
 *
 * Durante el arrastre se escucha en `window`, no en el tirador: si el puntero se
 * mueve rápido sale del elemento de 8 px y se perderían los eventos a media
 * maniobra.
 */
function Redimensionable({
  colKey,
  anchos,
  onAncho,
  children,
}: {
  colKey: string;
  anchos: Anchos;
  onAncho: (key: string, px: number) => void;
  children: React.ReactNode;
}) {
  const [arrastrando, setArrastrando] = useState(false);
  const inicio = useRef({ x: 0, ancho: 0 });

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const delta = e.clientX - inicio.current.x;
      onAncho(colKey, Math.max(anchoMinimoDe(colKey), inicio.current.ancho + delta));
    },
    [colKey, onAncho],
  );

  const onPointerUp = useCallback(() => setArrastrando(false), []);

  useEffect(() => {
    if (!arrastrando) return;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    // Sin esto el cursor parpadea y se va seleccionando texto de la tabla.
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = "";
    };
  }, [arrastrando, onPointerMove, onPointerUp]);

  return (
    <div className="relative min-w-0">
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Ajustar ancho de ${colKey}`}
        title="Arrastra para ajustar · doble clic para restaurar"
        className="absolute -right-1 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize touch-none rounded hover:bg-icam-900/20"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const actual =
            (e.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect()
              .width ??
            anchos[colKey] ??
            0;
          inicio.current = { x: e.clientX, ancho: actual };
          setArrastrando(true);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onAncho(colKey, 0); // 0 = borrar el guardado y volver al defecto
        }}
      />
    </div>
  );
}
