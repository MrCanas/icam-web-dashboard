"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtPctOrDash, fmtPctSigned } from "@/lib/formatters";
import type { PuntoVariacion } from "@/modules/corporativo/logic/calculations";
import { TooltipCorp, avisoPrevision } from "@/modules/corporativo/ui/charts/TooltipCorp";
import {
  DIVERGENTE,
  EJE,
  EJE_Y_ANCHO,
  GRID,
  MARGEN,
} from "@/modules/corporativo/ui/charts/tokens";

/**
 * Variación de la facturación contra el mismo periodo del año anterior.
 *
 * Es una magnitud con signo, así que lleva paleta divergente —verde azulado
 * arriba, rojo abajo— con el cero como punto neutro y una línea marcándolo. El
 * color no va solo: el signo está también en la etiqueta del tooltip y en el
 * lado de la línea base al que cae la barra.
 */
export function VarInteranualChart({ datos }: { datos: PuntoVariacion[] }) {
  return (
    <div className="h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={MARGEN}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="periodo" stroke={EJE} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            width={EJE_Y_ANCHO}
            stroke={EJE}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => fmtPctOrDash(Number(v))}
          />
          <ReferenceLine y={0} stroke={EJE} strokeWidth={1} />
          <Tooltip
            cursor={{ fill: GRID, fillOpacity: 0.5 }}
            content={
              <TooltipCorp
                titulo={(p) => String(p[0]?.payload?.periodo ?? "")}
                filas={(p) => {
                  const d = p[0]?.payload as PuntoVariacion | undefined;
                  const v = d?.variacionPct ?? null;
                  return [
                    {
                      etiqueta: v !== null && v < 0 ? "Cae respecto al año anterior" : "Crece respecto al año anterior",
                      valor: fmtPctSigned(v),
                      color: v !== null && v < 0 ? DIVERGENTE.negativo : DIVERGENTE.positivo,
                    },
                  ];
                }}
                pie={avisoPrevision}
              />
            }
          />
          <Bar
            dataKey="variacionPct"
            name="Variación interanual"
            radius={3}
            activeBar={false}
            isAnimationActive={false}
          >
            {datos.map((d) => (
              <Cell
                key={d.periodo}
                fill={
                  (d.variacionPct ?? 0) < 0 ? DIVERGENTE.negativo : DIVERGENTE.positivo
                }
                fillOpacity={d.cerrado ? 1 : 0.5}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
