"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  SITUACIONES,
  TIPOS,
  buildPortfolioHref,
  type PortfolioUrlParams,
  type ProyectosView,
} from "@/modules/portfolio/logic/portfolioParams";
import type { SortKey } from "@/modules/portfolio/logic/proyectoSort";
import { ToolbarPopover } from "@/modules/portfolio/ui/toolbar/ToolbarPopover";

/** Mismo valor que la barra de selección de Actas, por coherencia de tacto. */
const SEARCH_DEBOUNCE_MS = 250;

const OPCIONES_ORDEN: { key: SortKey; label: string }[] = [
  { key: "inversion", label: "Inversión ↓" },
  { key: "tir", label: "TIR ↓" },
  { key: "multiplo", label: "Múltiplo ↓" },
  { key: "beneficio", label: "Beneficio ↓" },
];

const OPCIONES_VISTA: { key: ProyectosView; label: string; icon: ReactNode }[] = [
  { key: "tabla", label: "Tabla", icon: <IconoTabla /> },
  { key: "cols2", label: "2 columnas", icon: <IconoColumnas n={2} /> },
  { key: "cols3", label: "3 columnas", icon: <IconoColumnas n={3} /> },
  { key: "cols4", label: "4 columnas", icon: <IconoColumnas n={4} /> },
];

export interface PortfolioToolbarProps {
  basePath: string;
  situacion?: string;
  tipo?: string;
  /** Texto a la izquierda: conteo de proyectos, inversión comprometida… */
  resumen?: ReactNode;
  /** Presentes solo donde tienen sentido (hoy, el tab de Proyectos). */
  sort?: SortKey;
  query?: string;
  view?: ProyectosView;
  /**
   * Crecimiento de las proyecciones (tanto por uno). La barra no lo edita: lo
   * arrastra para no borrarlo al navegar. Sin esto, tocar un filtro en
   * Tendencias devolvía el what-if a su valor por defecto.
   */
  crecimiento?: number;
}

/**
 * Barra de acciones flotante del dashboard de portfolio, anclada abajo al
 * estilo de Monday. Unifica lo que antes eran tres bloques apilados en la parte
 * superior de cada página (FilterBar, SituacionFilter y SortSelector).
 *
 * Todo el estado se escribe en la URL: las páginas son Server Components y
 * filtran en servidor, así que las vistas siguen siendo compartibles por enlace
 * y el botón atrás funciona. El buscador es la excepción parcial: mantiene el
 * texto en local para responder a cada tecla y vuelca a la URL con debounce.
 *
 * Filtros, orden y vista navegan con `push` para que atrás deshaga la elección
 * anterior, que es lo que espera cualquiera. El buscador usa `replace`: con
 * `push`, cada pulsación de tecla dejaría una entrada en el historial y volver
 * atrás sería borrar el texto letra a letra.
 */
export function PortfolioToolbar({
  basePath,
  situacion,
  tipo,
  resumen,
  sort,
  query,
  view,
  crecimiento,
}: PortfolioToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState(query ?? "");
  const [queryVisto, setQueryVisto] = useState(query);

  // Resincronizar el input cuando la URL cambia por otra vía (botón atrás,
  // enlace externo). Se ajusta en render, no en un efecto: hacerlo en un
  // efecto encadena un render extra por cada navegación.
  if (query !== queryVisto) {
    setQueryVisto(query);
    setTexto(query ?? "");
  }

  function navegar(cambios: Partial<PortfolioUrlParams>) {
    const href = buildPortfolioHref(basePath, {
      situacion,
      tipo,
      sort,
      // `texto`, no `query`: si se pulsa un filtro antes de que venza el
      // debounce, lo ya tecleado tiene que sobrevivir a la navegación.
      q: query === undefined ? undefined : texto,
      view,
      crecimiento,
      ...cambios,
    });
    startTransition(() => router.push(href, { scroll: false }));
  }

  // Volcado del buscador a la URL con debounce: se dispara solo cuando lo
  // tecleado se ha separado de lo que ya refleja la URL.
  useEffect(() => {
    if (query === undefined) return;
    if (texto === (query ?? "")) return;

    const id = setTimeout(() => {
      const href = buildPortfolioHref(basePath, {
        situacion,
        tipo,
        sort,
        view,
        crecimiento,
        q: texto,
      });
      startTransition(() => router.replace(href, { scroll: false }));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [texto, query, basePath, situacion, tipo, sort, view, crecimiento, router]);

  const hayFiltros = Boolean(situacion || tipo);
  const vistaActual = OPCIONES_VISTA.find((v) => v.key === view);

  return (
    <>
      {/* Reserva el hueco que tapa la barra fija. Va aquí, y no en el layout del
          dashboard, porque ese layout lo comparten las zonas pm, monday y data. */}
      <div aria-hidden className="h-20" />

      <div
        role="toolbar"
        aria-label="Filtros y vista del portfolio"
        aria-busy={pending}
        className="fixed bottom-4 left-1/2 z-[65] flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-lg border border-icam-900/25 bg-card px-3 py-2 shadow-xl"
      >
        {resumen ? (
          <span className="shrink-0 pr-1 text-sm text-text-muted whitespace-nowrap">{resumen}</span>
        ) : null}

        {query !== undefined ? (
          <label className="relative shrink-0">
            <span className="sr-only">Buscar proyecto</span>
            <input
              type="search"
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              placeholder="Buscar proyecto…"
              className="min-h-9 w-40 rounded-md border border-subtle bg-white px-2.5 py-1.5 text-sm text-text-body placeholder:text-text-muted focus:border-icam-900 focus:outline-none sm:w-52"
            />
          </label>
        ) : null}

        <ToolbarPopover
          label="Situación"
          value={situacion}
          active={Boolean(situacion)}
          ariaLabel="Filtrar por situación"
        >
          {(close) => (
            <ListaOpciones
              opciones={[
                { key: undefined, label: "Todas" },
                ...SITUACIONES.map((s) => ({ key: s, label: s })),
              ]}
              seleccion={situacion}
              onPick={(valor) => {
                close();
                navegar({ situacion: valor });
              }}
            />
          )}
        </ToolbarPopover>

        <ToolbarPopover
          label="Tipo"
          value={tipo}
          active={Boolean(tipo)}
          ariaLabel="Filtrar por tipo de proyecto"
        >
          {(close) => (
            <ListaOpciones
              opciones={[
                { key: undefined, label: "Todos" },
                ...TIPOS.map((t) => ({ key: t, label: t })),
              ]}
              seleccion={tipo}
              onPick={(valor) => {
                close();
                navegar({ tipo: valor });
              }}
            />
          )}
        </ToolbarPopover>

        {sort !== undefined ? (
          <ToolbarPopover
            label="Ordenar"
            value={OPCIONES_ORDEN.find((o) => o.key === sort)?.label}
            ariaLabel="Ordenar proyectos"
            width={200}
          >
            {(close) => (
              <ListaOpciones
                opciones={OPCIONES_ORDEN.map((o) => ({ key: o.key, label: o.label }))}
                seleccion={sort}
                onPick={(valor) => {
                  close();
                  navegar({ sort: (valor as SortKey) ?? "inversion" });
                }}
              />
            )}
          </ToolbarPopover>
        ) : null}

        {view !== undefined ? (
          <ToolbarPopover
            label="Vista"
            value={vistaActual?.label}
            ariaLabel="Modo de visualización"
            width={180}
          >
            {(close) => (
              <div className="flex flex-col gap-0.5">
                {OPCIONES_VISTA.map((opcion) => (
                  <button
                    key={opcion.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={view === opcion.key}
                    onClick={() => {
                      close();
                      navegar({ view: opcion.key });
                    }}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                      view === opcion.key
                        ? "bg-icam-900 text-white"
                        : "text-text-body hover:bg-page/80"
                    }`}
                  >
                    {opcion.icon}
                    {opcion.label}
                  </button>
                ))}
              </div>
            )}
          </ToolbarPopover>
        ) : null}

        {hayFiltros || texto ? (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              navegar({ situacion: undefined, tipo: undefined, q: "" });
            }}
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
    <div className="flex flex-col gap-0.5">
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

function IconoTabla() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor">
      <rect x="1" y="2" width="14" height="2.5" rx="0.5" />
      <rect x="1" y="6" width="14" height="2" rx="0.5" opacity="0.6" />
      <rect x="1" y="9.5" width="14" height="2" rx="0.5" opacity="0.6" />
      <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.6" />
    </svg>
  );
}

function IconoColumnas({ n }: { n: number }) {
  const ancho = (16 - (n + 1)) / n;
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden fill="currentColor">
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={1 + i * (ancho + 1)} y="2" width={ancho} height="12" rx="0.5" />
      ))}
    </svg>
  );
}
