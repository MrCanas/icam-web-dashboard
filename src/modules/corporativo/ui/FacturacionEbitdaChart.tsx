"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtEurosCompact, fmtPctOrDash } from "@/lib/formatters";
import type { PuntoFacturacionEbitda } from "@/modules/corporativo/logic/calculations";
import {
  LeyendaPrevision,
  PatronPrevision,
  rellenoSegun,
} from "@/modules/corporativo/ui/charts/PatronPrevision";
import { TooltipCorp, avisoPrevision } from "@/modules/corporativo/ui/charts/TooltipCorp";
import {
  EJE,
  EJE_Y_ANCHO,
  GRID,
  MARGEN,
  MARGEN_CON_ETIQUETA,
  SERIE,
} from "@/modules/corporativo/ui/charts/tokens";

interface FacturacionEbitdaChartProps {
  datos: PuntoFacturacionEbitda[];
  /** Etiqueta del último periodo cerrado; null si la serie no llega a previsión. */
  periodoCorte: string | null;
}

/**
 * Facturación y EBITDA por periodo, con el margen en una tira aparte debajo.
 *
 * El margen NO va como segundo eje Y de la misma gráfica. Un doble eje deja que
 * la escala elegida decida qué serie parece ir por delante, y quien lo mira no
 * tiene forma de saber que el cruce entre las líneas no significa nada. Dos
 * escalas distintas piden dos gráficas; van pegadas y comparten ancho de eje y
 * márgenes, así que las columnas siguen correspondiéndose.
 */
export function FacturacionEbitdaChart({ datos, periodoCorte }: FacturacionEbitdaChartProps) {
  const colores = [SERIE.uno, SERIE.dos];

  return (
    <div className="min-w-0">
      <div className="h-[300px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={MARGEN_CON_ETIQUETA} barGap={2}>
            <PatronPrevision colores={colores} />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="periodo" stroke={EJE} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtEurosCompact(Number(v))}
            />
            {periodoCorte ? (
              <ReferenceLine
                x={periodoCorte}
                stroke={EJE}
                strokeDasharray="4 3"
                label={{ value: "cierre", position: "top", fontSize: 10, fill: EJE }}
              />
            ) : null}
            <Tooltip
              cursor={{ fill: GRID, fillOpacity: 0.5 }}
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.periodo ?? "")}
                  filas={(p) => [
                    {
                      etiqueta: "Facturación",
                      valor: fmtEurosCompact(p[0]?.payload?.facturacion as number | null),
                      color: SERIE.uno,
                    },
                    {
                      etiqueta: "EBITDA",
                      valor: fmtEurosCompact(p[0]?.payload?.ebitda as number | null),
                      color: SERIE.dos,
                    },
                    {
                      etiqueta: "Margen",
                      valor: fmtPctOrDash(p[0]?.payload?.margenPct as number | null),
                    },
                  ]}
                  pie={avisoPrevision}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} itemSorter={null} />
            {/* Radio solo en el extremo de dato; el otro queda anclado a la línea base. */}
            <Bar
              dataKey="facturacion"
              name="Facturación"
              fill={SERIE.uno}
              radius={[3, 3, 0, 0]}
              activeBar={false}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell key={d.periodo} fill={rellenoSegun(d.cerrado, SERIE.uno)} />
              ))}
            </Bar>
            <Bar
              dataKey="ebitda"
              name="EBITDA"
              fill={SERIE.dos}
              radius={[3, 3, 0, 0]}
              activeBar={false}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell key={d.periodo} fill={rellenoSegun(d.cerrado, SERIE.dos)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tira del margen: su propia escala, alineada con la de arriba. */}
      <p className="mt-1 text-xs font-medium text-text-muted">Margen EBITDA</p>
      <div className="h-[84px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={MARGEN}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="periodo" hide />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtPctOrDash(Number(v))}
            />
            <ReferenceLine y={0} stroke={EJE} strokeWidth={1} />
            {periodoCorte ? (
              <ReferenceLine x={periodoCorte} stroke={EJE} strokeDasharray="4 3" />
            ) : null}
            <Tooltip
              cursor={{ stroke: EJE, strokeDasharray: "3 3" }}
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.periodo ?? "")}
                  filas={(p) => [
                    {
                      etiqueta: "Margen EBITDA",
                      valor: fmtPctOrDash(p[0]?.payload?.margenPct as number | null),
                      color: SERIE.uno,
                    },
                  ]}
                  pie={avisoPrevision}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="margenPct"
              name="Margen EBITDA"
              stroke={SERIE.uno}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <LeyendaPrevision periodoCorte={periodoCorte} />
    </div>
  );
}
