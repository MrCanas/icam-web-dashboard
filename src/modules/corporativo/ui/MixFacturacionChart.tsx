"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { fmtEurosCompact, fmtPct } from "@/lib/formatters";
import type { PorcionMix } from "@/modules/corporativo/logic/calculations";
import { TooltipCorp } from "@/modules/corporativo/ui/charts/TooltipCorp";
import { SERIE, SUPERFICIE } from "@/modules/corporativo/ui/charts/tokens";

/** Orden fijo: ICAM, ICI, GIIC. El color sigue a la sociedad, nunca a su tamaño. */
const COLOR_POR_SOCIEDAD: Record<string, string> = {
  ICAM: SERIE.uno,
  ICI: SERIE.dos,
  GIIC: SERIE.tres,
};

/**
 * De dónde viene la facturación del grupo. Anillo y no tarta: el hueco central
 * deja sitio al total, que es el dato que se busca antes que los porcentajes.
 *
 * Sale del desglose que el propio maestro trae en las filas agregadas, no de
 * recomponerlo sumando las filas de cada sociedad.
 */
export function MixFacturacionChart({ porciones }: { porciones: PorcionMix[] }) {
  const total = porciones.reduce((acc, p) => acc + p.valor, 0);

  return (
    <div className="min-w-0">
      <div className="relative h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.nombre ?? "")}
                  filas={(p) => {
                    const d = p[0]?.payload as PorcionMix | undefined;
                    if (!d) return [];
                    return [
                      {
                        etiqueta: "Facturación",
                        valor: fmtEurosCompact(d.valor),
                        color: COLOR_POR_SOCIEDAD[d.nombre],
                      },
                      {
                        etiqueta: "Peso",
                        valor: total > 0 ? fmtPct(d.valor / total) : "—",
                      },
                    ];
                  }}
                />
              }
            />
            <Pie
              data={porciones}
              dataKey="valor"
              nameKey="nombre"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {porciones.map((p) => (
                <Cell
                  key={p.nombre}
                  fill={COLOR_POR_SOCIEDAD[p.nombre] ?? SERIE.uno}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Total en el centro del anillo. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-text-muted">Total</span>
          <span className="text-xl font-semibold text-text-primary">
            {fmtEurosCompact(total)}
          </span>
        </div>
      </div>

      {/* Leyenda con etiqueta directa: identidad e importe sin depender del color. */}
      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {porciones.map((p) => (
          <li key={p.nombre} className="flex items-center gap-1.5 text-xs text-text-body">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: COLOR_POR_SOCIEDAD[p.nombre] }}
            />
            <span className="font-medium">{p.nombre}</span>
            <span className="tabular-nums text-text-muted">
              {fmtEurosCompact(p.valor)}
              {total > 0 ? ` · ${fmtPct(p.valor / total)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
