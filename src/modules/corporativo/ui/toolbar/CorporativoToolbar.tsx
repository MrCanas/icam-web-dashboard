"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ToolbarPopover } from "@/components/ui/ToolbarPopover";
import {
  ANIO_MINIMO,
  GRANULARIDAD_DEFAULT,
  SOCIEDAD_DEFAULT,
  buildCorporativoHref,
  type CorporativoUrlParams,
  type Granularidad,
} from "@/modules/corporativo/logic/corporativoParams";
import { SOCIEDADES, type Sociedad } from "@/modules/corporativo/types";

const OPCIONES_GRANULARIDAD: { key: Granularidad; label: string }[] = [
  { key: "trimestre", label: "Trimestre" },
  { key: "anio", label: "Año" },
];

export interface CorporativoToolbarProps {
  basePath: string;
  sociedad: Sociedad;
  granularidad: Granularidad;
  /** `undefined` = sin recorte (desde el principio del maestro). */
  desde?: number;
  prevision: boolean;
  /** Años presentes en el maestro, para el selector «Desde». */
  anios: number[];
  /** Texto a la izquierda: periodo de referencia, nº de periodos… */
  resumen?: ReactNode;
}

/**
 * Barra flotante del tab Corporativas, con el mismo tacto que la del portfolio:
 * anclada abajo, controles en popover que se abre hacia arriba y todo el estado
 * escrito en la URL.
 *
 * No reutiliza `PortfolioToolbar` porque aquella tiene cableados sus filtros
 * (situación, tipo, orden, vista) y ninguno significa nada aquí. Lo que sí se
 * comparte es `ToolbarPopover`, que es la pieza con la mecánica delicada
 * (portal, cierre al pulsar fuera, recolocación al hacer scroll).
 *
 * Navegación con `push`: cada elección deja entrada en el historial, para que
 * «atrás» deshaga el último filtro, que es lo que espera cualquiera.
 */
export function CorporativoToolbar({
  basePath,
  sociedad,
  granularidad,
  desde,
  prevision,
  anios,
  resumen,
}: CorporativoToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navegar(cambios: Partial<CorporativoUrlParams>) {
    const href = buildCorporativoHref(basePath, {
      sociedad,
      granularidad,
      desde,
      prevision,
      ...cambios,
    });
    startTransition(() => router.push(href, { scroll: false }));
  }

  const aniosSeleccionables = anios.filter((a) => a > ANIO_MINIMO);
  const hayFiltros =
    sociedad !== SOCIEDAD_DEFAULT ||
    granularidad !== GRANULARIDAD_DEFAULT ||
    desde !== undefined ||
    !prevision;

  return (
    <>
      {/* Reserva el hueco que tapa la barra fija. Va aquí y no en el layout del
          dashboard, porque ese layout lo comparten las demás zonas. */}
      <div aria-hidden className="h-20" />

      <div
        role="toolbar"
        aria-label="Filtros del tab Corporativas"
        aria-busy={pending}
        className="fixed bottom-4 left-1/2 z-[65] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-lg border border-icam-900/25 bg-card px-3 py-2 shadow-xl"
      >
        {resumen ? (
          <span className="shrink-0 pr-1 text-sm text-text-muted whitespace-nowrap">
            {resumen}
          </span>
        ) : null}

        <ToolbarPopover
          label="Sociedad"
          value={sociedad}
          active={sociedad !== SOCIEDAD_DEFAULT}
          ariaLabel="Filtrar por sociedad"
          width={200}
        >
          {(close) => (
            <ListaOpciones
              opciones={SOCIEDADES.map((s) => ({ key: s, label: s }))}
              seleccion={sociedad}
              onPick={(valor) => {
                close();
                navegar({ sociedad: valor as Sociedad });
              }}
            />
          )}
        </ToolbarPopover>

        <ToolbarPopover
          label="Periodo"
          value={OPCIONES_GRANULARIDAD.find((g) => g.key === granularidad)?.label}
          active={granularidad !== GRANULARIDAD_DEFAULT}
          ariaLabel="Granularidad temporal"
          width={180}
        >
          {(close) => (
            <ListaOpciones
              opciones={OPCIONES_GRANULARIDAD.map((g) => ({ key: g.key, label: g.label }))}
              seleccion={granularidad}
              onPick={(valor) => {
                close();
                navegar({ granularidad: (valor as Granularidad) ?? GRANULARIDAD_DEFAULT });
              }}
            />
          )}
        </ToolbarPopover>

        <ToolbarPopover
          label="Desde"
          value={desde ? String(desde) : undefined}
          active={desde !== undefined}
          ariaLabel="Año de inicio de las series"
          width={160}
        >
          {(close) => (
            <ListaOpciones
              opciones={[
                { key: undefined, label: "Todo el histórico" },
                ...aniosSeleccionables.map((a) => ({ key: String(a), label: String(a) })),
              ]}
              seleccion={desde ? String(desde) : undefined}
              onPick={(valor) => {
                close();
                navegar({ desde: valor ? Number(valor) : undefined });
              }}
            />
          )}
        </ToolbarPopover>

        {/* Interruptor y no popover: es binario y se toca a menudo. */}
        <button
          type="button"
          role="switch"
          aria-checked={prevision}
          onClick={() => navegar({ prevision: !prevision })}
          className={`min-h-9 shrink-0 rounded-md border px-2.5 py-1.5 text-sm ${
            prevision
              ? "border-icam-900 bg-icam-900 text-white"
              : "border-subtle text-text-body hover:bg-page/80"
          }`}
        >
          Previsión
        </button>

        {hayFiltros ? (
          <button
            type="button"
            onClick={() =>
              navegar({
                sociedad: SOCIEDAD_DEFAULT,
                granularidad: GRANULARIDAD_DEFAULT,
                desde: undefined,
                prevision: true,
              })
            }
            className="min-h-9 shrink-0 rounded-md border border-icam-gold px-2.5 py-1.5 text-sm text-icam-gold hover:bg-icam-gold hover:text-white"
          >
            Limpiar
          </button>
        ) : null}
      </div>
    </>
  );
}

function ListaOpciones({
  opciones,
  seleccion,
  onPick,
}: {
  opciones: { key?: string; label: string }[];
  seleccion?: string;
  onPick: (valor?: string) => void;
}) {
  return (
    <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
      {opciones.map((opcion) => (
        <button
          key={opcion.label}
          type="button"
          role="menuitemradio"
          aria-checked={seleccion === opcion.key}
          onClick={() => onPick(opcion.key)}
          className={`rounded px-2 py-1.5 text-left text-sm ${
            seleccion === opcion.key
              ? "bg-icam-900 text-white"
              : "text-text-body hover:bg-page/80"
          }`}
        >
          {opcion.label}
        </button>
      ))}
    </div>
  );
}
