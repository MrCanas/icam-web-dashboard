"use client";

import type { ReactElement } from "react";

/** Punto del payload que Recharts inyecta en el `content` del Tooltip. */
export interface TooltipPoint {
  name?: string | number;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

export interface DrilldownTooltipRow {
  label: string;
  value: string;
  color?: string;
}

interface DrilldownTooltipProps {
  /** Inyectados por Recharts. */
  active?: boolean;
  payload?: TooltipPoint[];
  /** Cabecera del recuadro; por defecto, el `name` del primer punto. */
  heading?: (payload: TooltipPoint[]) => string;
  /** Filas a pintar a partir del payload. */
  rows: (payload: TooltipPoint[]) => DrilldownTooltipRow[];
  /**
   * Pista de interacción. El recuadro de Recharts no es clicable (desaparece al
   * mover el ratón hacia él), así que el click va sobre la propia marca y aquí
   * solo se anuncia. Acepta una función para ocultarla en las marcas que no
   * llevan a ninguna parte (p. ej. un año sin vencimientos).
   */
  hint?: string | false | ((payload: TooltipPoint[]) => string | false);
}

const HINT_POR_DEFECTO = "Click para ver detalle";

export function DrilldownTooltip({
  active,
  payload,
  heading,
  rows,
  hint = HINT_POR_DEFECTO,
}: DrilldownTooltipProps): ReactElement | null {
  if (!active || !payload || payload.length === 0) return null;

  const titulo = heading ? heading(payload) : String(payload[0]?.name ?? "");
  const filas = rows(payload);
  const pista = typeof hint === "function" ? hint(payload) : hint;

  return (
    <div className="rounded-md border border-subtle bg-card px-3 py-2 shadow-lg">
      {titulo ? (
        <p className="text-sm font-semibold text-icam-900 mb-1">{titulo}</p>
      ) : null}
      <ul className="space-y-0.5">
        {filas.map((fila) => (
          <li key={fila.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-text-body">
              {fila.color ? (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: fila.color }}
                />
              ) : null}
              {fila.label}
            </span>
            <span className="tabular-nums font-medium text-icam-900">{fila.value}</span>
          </li>
        ))}
      </ul>
      {pista ? <p className="mt-1.5 text-xs text-text-muted">{pista}</p> : null}
    </div>
  );
}
