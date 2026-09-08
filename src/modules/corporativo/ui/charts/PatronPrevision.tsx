"use client";

import { SUPERFICIE } from "@/modules/corporativo/ui/charts/tokens";

/**
 * Trama diagonal para los periodos que aún no están cerrados.
 *
 * La previsión se pinta, no se esconde: 2026 3T y 4T son el plan del año en curso
 * y quitarlos deja media gráfica sin explicación. Pero tiene que distinguirse de
 * un cierre sin depender del color, que ya está ocupado identificando la serie.
 * De ahí la trama: funciona en escala de grises, impresa y con cualquier tipo de
 * daltonismo.
 *
 * Se declara un patrón por color de serie porque SVG no permite teñir un `pattern`
 * desde quien lo usa.
 */

export function idPatron(color: string): string {
  return `corp-prevision-${color.replace("#", "")}`;
}

/** Devuelve `url(#…)` si el periodo es previsión, y el color plano si está cerrado. */
export function rellenoSegun(cerrado: boolean, color: string): string {
  return cerrado ? color : `url(#${idPatron(color)})`;
}

/**
 * `<defs>` con un patrón por cada color que use la gráfica. Va como hijo directo
 * del componente de Recharts, que lo inyecta en el SVG.
 */
export function PatronPrevision({ colores }: { colores: string[] }) {
  return (
    <defs>
      {[...new Set(colores)].map((color) => (
        <pattern
          key={color}
          id={idPatron(color)}
          patternUnits="userSpaceOnUse"
          width={6}
          height={6}
          patternTransform="rotate(45)"
        >
          <rect width={6} height={6} fill={color} opacity={0.28} />
          <line x1={0} y1={0} x2={0} y2={6} stroke={color} strokeWidth={2.5} />
        </pattern>
      ))}
    </defs>
  );
}

/** Leyenda del corte: se muestra solo cuando la serie llega a la previsión. */
export function LeyendaPrevision({ periodoCorte }: { periodoCorte: string | null }) {
  if (!periodoCorte) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
      <svg width="14" height="10" aria-hidden className="shrink-0">
        <rect width="14" height="10" fill={SUPERFICIE} />
        <rect width="14" height="10" fill="#8A8A8A" opacity={0.28} />
        <line x1="3" y1="10" x2="10" y2="0" stroke="#8A8A8A" strokeWidth="2.5" />
      </svg>
      Previsión: a partir de {periodoCorte} las cifras son plan, no cierre.
    </p>
  );
}
