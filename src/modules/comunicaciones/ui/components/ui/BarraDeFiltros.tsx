"use client";

import type { ReactNode } from "react";

import { claseCampo } from "@/components/ui/Campo";
import { Icono } from "@/components/ui/Icono";
import { fmtInt } from "@/lib/formatters";

export interface OpcionDeFiltro<K extends string> {
  clave: K;
  etiqueta: string;
  /** Cuántos cumplen. Sin él, la pastilla no enseña número. */
  n?: number;
  /** Apagada, con el motivo en el `title`. */
  deshabilitada?: string;
}

/**
 * Pastillas de filtro con recuento y, si se quiere, un buscador y algo más a
 * la derecha (un botón de acción, un selector).
 */
export function BarraDeFiltros<K extends string>({
  opciones,
  valor,
  onChange,
  busqueda,
  onBusqueda,
  placeholder = "Buscar",
  extra,
  etiqueta = "Filtrar",
}: {
  opciones: OpcionDeFiltro<K>[];
  valor: K;
  onChange: (clave: K) => void;
  busqueda?: string;
  onBusqueda?: (texto: string) => void;
  placeholder?: string;
  extra?: ReactNode;
  etiqueta?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1.5">
        {opciones.map((o) => {
          const activa = o.clave === valor;
          return (
            <button
              key={o.clave}
              type="button"
              aria-pressed={activa}
              disabled={Boolean(o.deshabilitada)}
              title={o.deshabilitada}
              onClick={() => onChange(o.clave)}
              className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                activa
                  ? "border-icam-900 bg-icam-900 text-white"
                  : "border-subtle bg-card text-text-body hover:border-icam-900/40 hover:text-icam-900"
              }`}
            >
              {o.etiqueta}
              {o.n !== undefined ? (
                <span className={`tabular-nums ${activa ? "text-white/80" : "text-text-muted"}`}>{fmtInt(o.n)}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {onBusqueda ? (
        <label className="relative ml-auto min-w-[220px] flex-1 sm:max-w-xs">
          <span className="sr-only">{placeholder}</span>
          <Icono nombre="buscar" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={busqueda ?? ""}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder={placeholder}
            className={`${claseCampo} py-1.5 pl-8 text-xs`}
          />
        </label>
      ) : null}
      {extra ? <div className={`flex items-center gap-2 ${onBusqueda ? "" : "ml-auto"}`}>{extra}</div> : null}
    </div>
  );
}
