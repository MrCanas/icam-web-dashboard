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

import { fmtEurosCompact, fmtIntOrDash } from "@/lib/formatters";
import type { PuntoAum } from "@/modules/corporativo/logic/calculations";
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

interface AumVehiculosChartProps {
  datos: PuntoAum[];
  periodoCorte: string | null;
}

/**
 * Capital bajo gestión por perímetro regulatorio, con el nº de vehículos en una
 * tira aparte debajo. Igual que en la gráfica de facturación: euros y unidades
 * son escalas distintas y no comparten eje.
 *
 * El AUM es un SALDO a una fecha. Cada barra es la foto al cierre de su periodo,
 * no lo captado durante él: no tiene sentido sumarlas entre sí.
 */
export function AumVehiculosChart({ datos, periodoCorte }: AumVehiculosChartProps) {
  const colores = [SERIE.uno, SERIE.dos];

  return (
    <div className="min-w-0">
      <div className="h-[240px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={MARGEN}>
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
              <ReferenceLine x={periodoCorte} stroke={EJE} strokeDasharray="4 3" />
            ) : null}
            <Tooltip
              cursor={{ fill: GRID, fillOpacity: 0.5 }}
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.periodo ?? "")}
                  filas={(p) => {
                    const d = p[0]?.payload as PuntoAum | undefined;
                    if (!d) return [];
                    return [
                      {
                        etiqueta: "Regulado (ICAM)",
                        valor: fmtEurosCompact(d.reguladoIcam),
                        color: SERIE.uno,
                      },
                      {
                        etiqueta: "No regulado (ICI)",
                        valor: fmtEurosCompact(d.noReguladoIci),
                        color: SERIE.dos,
                      },
                      { etiqueta: "Total AUM", valor: fmtEurosCompact(d.total) },
                      { etiqueta: "Vehículos", valor: fmtIntOrDash(d.vehiculos) },
                    ];
                  }}
                  pie={avisoPrevision}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} itemSorter={null} />
            <Bar
              dataKey="reguladoIcam"
              name="Regulado (ICAM)"
              stackId="aum"
              fill={SERIE.uno}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                // 2 px del color de la tarjeta entre los dos tramos apilados.
                <Cell
                  key={d.periodo}
                  fill={rellenoSegun(d.cerrado, SERIE.uno)}
                  stroke={SUPERFICIE}
                  strokeWidth={2}
                />
              ))}
            </Bar>
            <Bar
              dataKey="noReguladoIci"
              name="No regulado (ICI)"
              stackId="aum"
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
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs font-medium text-text-muted">Vehículos en gestión</p>
      <div className="h-[76px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={MARGEN}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="periodo" hide />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 10 }}
              allowDecimals={false}
              tickFormatter={(v) => fmtIntOrDash(Number(v))}
            />
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
                      etiqueta: "Vehículos",
                      valor: fmtIntOrDash(p[0]?.payload?.vehiculos as number | null),
                      color: SERIE.uno,
                    },
                  ]}
                  pie={avisoPrevision}
                />
              }
            />
            <Line
              type="stepAfter"
              dataKey="vehiculos"
              name="Vehículos"
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
