"use client";

import type { ReactNode } from "react";

export interface FilaTooltip {
  etiqueta: string;
  valor: string;
  color?: string;
}

export interface PuntoTooltip {
  dataKey?: string | number;
  value?: number | string | null;
  color?: string;
  name?: string | number;
  payload?: Record<string, unknown>;
}

interface TooltipCorpProps {
  active?: boolean;
  payload?: PuntoTooltip[];
  /** Encabezado: normalmente el periodo. */
  titulo: (payload: PuntoTooltip[]) => string;
  filas: (payload: PuntoTooltip[]) => FilaTooltip[];
  /** Aviso al pie, p. ej. que el periodo es previsión. */
  pie?: (payload: PuntoTooltip[]) => ReactNode;
}

/**
 * Tooltip único de las gráficas del tab. Recharts pinta por defecto un cuadro con
 * los nombres de las claves de datos (`a`, `b`), que no le dicen nada a nadie;
 * aquí cada gráfica declara qué texto quiere.
 */
export function TooltipCorp({ active, payload, titulo, filas, pie }: TooltipCorpProps) {
  if (!active || !payload || payload.length === 0) return null;

  const lineas = filas(payload);
  const aviso = pie?.(payload);

  return (
    <div className="rounded-md border border-subtle bg-card px-2.5 py-2 shadow-lg">
      <p className="text-xs font-semibold text-text-primary">{titulo(payload)}</p>
      <ul className="mt-1 space-y-0.5">
        {lineas.map((fila) => (
          <li key={fila.etiqueta} className="flex items-center gap-1.5 text-xs text-text-body">
            {fila.color ? (
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: fila.color }}
              />
            ) : null}
            <span className="text-text-muted">{fila.etiqueta}</span>
            <span className="ml-auto pl-3 font-medium tabular-nums">{fila.valor}</span>
          </li>
        ))}
      </ul>
      {aviso ? <p className="mt-1.5 text-[11px] text-text-muted">{aviso}</p> : null}
    </div>
  );
}

/** Aviso de pie reutilizable: el punto pertenece a un periodo no cerrado. */
export function avisoPrevision(payload: PuntoTooltip[]): ReactNode {
  const cerrado = payload[0]?.payload?.cerrado;
  return cerrado === false ? "Previsión, no cierre." : null;
}
