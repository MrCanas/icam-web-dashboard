"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtEurosCompact, fmtEurosSigned } from "@/lib/formatters";
import type { PuntoCaja } from "@/modules/corporativo/logic/calculations";
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
} from "@/modules/corporativo/ui/charts/tokens";

interface CajaChartProps {
  datos: PuntoCaja[];
  periodoCorte: string | null;
}

/**
 * Saldo de caja al cierre frente al EBITDA de caja generado en el trimestre.
 *
 * Las dos series son euros, así que comparten eje sin trampa. Son cosas
 * distintas y por eso se pintan distinto: el saldo es un STOCK (área continua,
 * la altura del depósito) y el EBITDA de caja es un FLUJO (barras, lo que entró
 * o salió ese trimestre). Juntas responden a si la caja sube porque el negocio
 * genera o por otra cosa.
 */
export function CajaChart({ datos, periodoCorte }: CajaChartProps) {
  return (
    <div className="min-w-0">
      <div className="h-[260px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={datos} margin={MARGEN}>
            <PatronPrevision colores={[SERIE.dos]} />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="periodo" stroke={EJE} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtEurosCompact(Number(v))}
            />
            <ReferenceLine y={0} stroke={EJE} strokeWidth={1} />
            {periodoCorte ? (
              <ReferenceLine x={periodoCorte} stroke={EJE} strokeDasharray="4 3" />
            ) : null}
            <Tooltip
              cursor={{ fill: GRID, fillOpacity: 0.5 }}
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.periodo ?? "")}
                  filas={(p) => {
                    const d = p[0]?.payload as PuntoCaja | undefined;
                    if (!d) return [];
                    return [
                      {
                        etiqueta: "Saldo de caja al cierre",
                        valor: fmtEurosCompact(d.saldoCaja),
                        color: SERIE.uno,
                      },
                      {
                        etiqueta: "EBITDA de caja del periodo",
                        valor: fmtEurosSigned(d.ebitdaCaja),
                        color: SERIE.dos,
                      },
                    ];
                  }}
                  pie={avisoPrevision}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} itemSorter={null} />
            <Bar
              dataKey="ebitdaCaja"
              name="EBITDA de caja del periodo"
              fill={SERIE.dos}
              radius={3}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell key={d.periodo} fill={rellenoSegun(d.cerrado, SERIE.dos)} />
              ))}
            </Bar>
            <Area
              type="monotone"
              dataKey="saldoCaja"
              name="Saldo de caja al cierre"
              stroke={SERIE.uno}
              strokeWidth={2}
              fill={SERIE.uno}
              fillOpacity={0.12}
              dot={{ r: 2.5, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <LeyendaPrevision periodoCorte={periodoCorte} />
    </div>
  );
}
