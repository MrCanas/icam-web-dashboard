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
import type { PuntoGastos } from "@/modules/corporativo/logic/calculations";
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
  SERIE,
  SUPERFICIE,
} from "@/modules/corporativo/ui/charts/tokens";

interface EstructuraGastosChartProps {
  datos: PuntoGastos[];
  periodoCorte: string | null;
}

/** Gris del tramo sin desglosar: no es una serie más, es ausencia de detalle. */
const SIN_DESGLOSE = "#B4B7BE";

/**
 * En qué se va el dinero: variables frente a estructura, con el peso de los
 * gastos sobre la facturación en su propia tira.
 *
 * El desglose solo viene relleno cuando variables + estructura cuadra con el
 * total; el maestro prefiere dejarlo vacío antes que publicar un reparto
 * erróneo, y GIIC 2021-2023 no lo tiene. Esos periodos se pintan en gris con su
 * gasto total, para que el hueco se vea como lo que es —falta de detalle— y no
 * como un trimestre sin gastos.
 */
export function EstructuraGastosChart({ datos, periodoCorte }: EstructuraGastosChartProps) {
  const hayHuecos = datos.some((d) => d.sinDesglose !== null);

  return (
    <div className="min-w-0">
      <div className="h-[250px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={MARGEN}>
            <PatronPrevision colores={[SERIE.uno, SERIE.dos, SIN_DESGLOSE]} />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="periodo" stroke={EJE} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtEurosCompact(Number(v))}
            />
            {periodoCorte ? (
              <ReferenceLine x={periodoCorte} stroke={EJE} strokeDasharray="4 3" />
            ) : null}
            <Tooltip
              cursor={{ fill: GRID, fillOpacity: 0.5 }}
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.periodo ?? "")}
                  filas={(p) => {
                    const d = p[0]?.payload as PuntoGastos | undefined;
                    if (!d) return [];
                    if (d.sinDesglose !== null) {
                      return [
                        {
                          etiqueta: "Gastos totales (sin desglose)",
                          valor: fmtEurosCompact(d.sinDesglose),
                          color: SIN_DESGLOSE,
                        },
                        {
                          etiqueta: "Sobre facturación",
                          valor: fmtPctOrDash(d.gastosSobreFacturacionPct),
                        },
                      ];
                    }
                    return [
                      {
                        etiqueta: "Variables",
                        valor: fmtEurosCompact(d.variables),
                        color: SERIE.uno,
                      },
                      {
                        etiqueta: "Estructura",
                        valor: fmtEurosCompact(d.estructura),
                        color: SERIE.dos,
                      },
                      {
                        etiqueta: "Sobre facturación",
                        valor: fmtPctOrDash(d.gastosSobreFacturacionPct),
                      },
                    ];
                  }}
                  pie={avisoPrevision}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} itemSorter={null} />
            <Bar
              dataKey="variables"
              name="Gastos variables"
              stackId="gastos"
              fill={SERIE.uno}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell
                  key={d.periodo}
                  fill={rellenoSegun(d.cerrado, SERIE.uno)}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                />
              ))}
            </Bar>
            <Bar
              dataKey="estructura"
              name="Gastos de estructura"
              stackId="gastos"
              fill={SERIE.dos}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell
                  key={d.periodo}
                  fill={rellenoSegun(d.cerrado, SERIE.dos)}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                />
              ))}
            </Bar>
            <Bar
              dataKey="sinDesglose"
              name="Total sin desglose"
              stackId="gastos"
              fill={SIN_DESGLOSE}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell key={d.periodo} fill={rellenoSegun(d.cerrado, SIN_DESGLOSE)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs font-medium text-text-muted">Gastos sobre facturación</p>
      <div className="h-[76px] w-full min-w-0">
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
            {/* El 100 % es la frontera: por encima, el periodo gasta más de lo que factura. */}
            <ReferenceLine y={1} stroke={EJE} strokeDasharray="3 3" />
            <Tooltip
              cursor={{ stroke: EJE, strokeDasharray: "3 3" }}
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.periodo ?? "")}
                  filas={(p) => [
                    {
                      etiqueta: "Gastos / facturación",
                      valor: fmtPctOrDash(
                        p[0]?.payload?.gastosSobreFacturacionPct as number | null,
                      ),
                      color: SERIE.uno,
                    },
                  ]}
                  pie={avisoPrevision}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="gastosSobreFacturacionPct"
              name="Gastos / facturación"
              stroke={SERIE.uno}
              strokeWidth={2}
              dot={{ r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hayHuecos ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: SIN_DESGLOSE }}
          />
          En gris, los periodos donde el maestro no publica el reparto variables/estructura.
        </p>
      ) : null}
      <LeyendaPrevision periodoCorte={periodoCorte} />
    </div>
  );
}
