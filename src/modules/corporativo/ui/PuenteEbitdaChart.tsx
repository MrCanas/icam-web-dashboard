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

import { fmtEurosCompact, fmtEurosSigned } from "@/lib/formatters";
import type { PasoPuente } from "@/modules/corporativo/logic/calculations";
import { TooltipCorp } from "@/modules/corporativo/ui/charts/TooltipCorp";
import {
  DIVERGENTE,
  EJE,
  EJE_Y_ANCHO,
  GRID,
  MARGEN,
  SERIE,
  SUPERFICIE,
} from "@/modules/corporativo/ui/charts/tokens";

/**
 * Puente de EBITDA: de la facturación al EBITDA, pasando por cada bloque de
 * gasto. Es la gráfica que responde a «¿por qué el EBITDA es este y no otro?».
 *
 * Construcción: una barra apilada por paso, donde el tramo de abajo es
 * transparente y solo sirve para levantar el visible hasta la altura del
 * acumulado. Los dos extremos (facturación y EBITDA) arrancan de cero: son
 * totales, no saltos, y por eso se pintan en el azul de serie mientras los
 * tramos intermedios usan el par divergente según sumen o resten.
 */
export function PuenteEbitdaChart({ pasos }: { pasos: PasoPuente[] }) {
  const alto = Math.max(260, pasos.length * 52);

  // Tres papeles, tres colores: los extremos son totales (navy), lo que resta va
  // en ladrillo y lo que suma en oro. El positivo NO usa `DIVERGENTE.positivo`
  // porque es el mismo navy de los totales y un tramo que suma se confundiría
  // con el cierre del puente.
  function color(paso: PasoPuente): string {
    if (paso.total) return SERIE.uno;
    return paso.valor >= 0 ? SERIE.dos : DIVERGENTE.negativo;
  }

  return (
    <div className="w-full min-w-0" style={{ height: alto }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pasos} margin={MARGEN} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="nombre"
            stroke={EJE}
            tick={{ fontSize: 10 }}
            interval={0}
            angle={-12}
            textAnchor="end"
            height={52}
          />
          <YAxis
            width={EJE_Y_ANCHO}
            stroke={EJE}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => fmtEurosCompact(Number(v))}
          />
          <ReferenceLine y={0} stroke={EJE} strokeWidth={1} />
          <Tooltip
            cursor={{ fill: GRID, fillOpacity: 0.5 }}
            content={
              <TooltipCorp
                titulo={(p) => String(p[0]?.payload?.nombre ?? "")}
                filas={(p) => {
                  const paso = p[0]?.payload as PasoPuente | undefined;
                  if (!paso) return [];
                  return [
                    {
                      etiqueta: paso.total ? "Importe" : "Aporta",
                      valor: paso.total
                        ? fmtEurosCompact(paso.valor)
                        : fmtEurosSigned(paso.valor),
                      color: color(paso),
                    },
                  ];
                }}
              />
            }
          />
          {/* Tramo invisible que coloca la barra a la altura del acumulado. */}
          <Bar dataKey="base" stackId="puente" fill="transparent" isAnimationActive={false} />
          <Bar
            dataKey={(p: PasoPuente) => Math.abs(p.valor)}
            stackId="puente"
            radius={3}
            isAnimationActive={false}
          >
            {pasos.map((paso) => (
              // 2 px del color de la tarjeta separan cada tramo del contiguo.
              <Cell
                key={paso.nombre}
                fill={color(paso)}
                stroke={SUPERFICIE}
                strokeWidth={2}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
