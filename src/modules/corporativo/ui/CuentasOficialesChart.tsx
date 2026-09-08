"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fmtEurosCompact, fmtEurosSigned } from "@/lib/formatters";
import type { PuntoCuentas } from "@/modules/corporativo/logic/calculations";
import { TooltipCorp } from "@/modules/corporativo/ui/charts/TooltipCorp";
import {
  DIVERGENTE,
  EJE,
  EJE_Y_ANCHO,
  GRID,
  MARGEN,
  SERIE,
} from "@/modules/corporativo/ui/charts/tokens";

/**
 * Cuentas depositadas de GIIC frente a la facturación de gestión, año a año.
 *
 * Es el contraste que nadie tiene a mano: lo que dice el cash flow con el que se
 * gestiona el día a día y lo que se acabó depositando en el Registro. Que las
 * dos barras se parezcan es la comprobación; que no, la pregunta.
 */
export function CuentasVsGestionChart({ datos }: { datos: PuntoCuentas[] }) {
  return (
    <div className="h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={MARGEN} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="anio" stroke={EJE} tick={{ fontSize: 10 }} />
          <YAxis
            width={EJE_Y_ANCHO}
            stroke={EJE}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => fmtEurosCompact(Number(v))}
          />
          <Tooltip
            cursor={{ fill: GRID, fillOpacity: 0.5 }}
            content={
              <TooltipCorp
                titulo={(p) => String(p[0]?.payload?.anio ?? "")}
                filas={(p) => {
                  const d = p[0]?.payload as PuntoCuentas | undefined;
                  if (!d) return [];
                  const diferencia =
                    d.cuentas !== null && d.gestion !== null ? d.cuentas - d.gestion : null;
                  return [
                    {
                      etiqueta: "Cifra de negocio (cuentas)",
                      valor: fmtEurosCompact(d.cuentas),
                      color: SERIE.uno,
                    },
                    {
                      etiqueta: "Facturación (gestión)",
                      valor: fmtEurosCompact(d.gestion),
                      color: SERIE.dos,
                    },
                    { etiqueta: "Diferencia", valor: fmtEurosSigned(diferencia) },
                  ];
                }}
              />
            }
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} itemSorter={null} />
          <Bar
            dataKey="cuentas"
            name="Cifra de negocio (cuentas depositadas)"
            fill={SERIE.uno}
            radius={[3, 3, 0, 0]}
            activeBar={false}
            isAnimationActive={false}
          />
          <Bar
            dataKey="gestion"
            name="Facturación (cash flow de gestión)"
            fill={SERIE.dos}
            radius={[3, 3, 0, 0]}
            activeBar={false}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Balance oficial de GIIC: activo, patrimonio neto y efectivo a cierre de
 * ejercicio. Tres series apiladas no —son magnitudes anidadas, no partes de un
 * todo—, sino agrupadas, con el resultado del ejercicio en su propia tira porque
 * cambia de signo y su escala no tiene nada que ver con la del balance.
 */
export function BalanceChart({ datos }: { datos: PuntoCuentas[] }) {
  return (
    <div className="min-w-0">
      <div className="h-[220px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={MARGEN} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="anio" stroke={EJE} tick={{ fontSize: 10 }} />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtEurosCompact(Number(v))}
            />
            <Tooltip
              cursor={{ fill: GRID, fillOpacity: 0.5 }}
              content={
                <TooltipCorp
                  titulo={(p) => String(p[0]?.payload?.anio ?? "")}
                  filas={(p) => {
                    const d = p[0]?.payload as PuntoCuentas | undefined;
                    if (!d) return [];
                    return [
                      { etiqueta: "Total activo", valor: fmtEurosCompact(d.totalActivo), color: SERIE.uno },
                      { etiqueta: "Patrimonio neto", valor: fmtEurosCompact(d.patrimonioNeto), color: SERIE.dos },
                      { etiqueta: "Efectivo", valor: fmtEurosCompact(d.efectivo), color: SERIE.tres },
                    ];
                  }}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} itemSorter={null} />
            <Bar dataKey="totalActivo" name="Total activo" fill={SERIE.uno} radius={[3, 3, 0, 0]} activeBar={false} isAnimationActive={false} />
            <Bar dataKey="patrimonioNeto" name="Patrimonio neto" fill={SERIE.dos} radius={[3, 3, 0, 0]} activeBar={false} isAnimationActive={false} />
            <Bar dataKey="efectivo" name="Efectivo" fill={SERIE.tres} radius={[3, 3, 0, 0]} activeBar={false} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-1 text-xs font-medium text-text-muted">Resultado del ejercicio</p>
      <div className="h-[92px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={MARGEN}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="anio" hide />
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
                  titulo={(p) => String(p[0]?.payload?.anio ?? "")}
                  filas={(p) => {
                    const d = p[0]?.payload as PuntoCuentas | undefined;
                    if (!d) return [];
                    return [
                      {
                        etiqueta: "Resultado del ejercicio",
                        valor: fmtEurosSigned(d.resultadoEjercicio),
                        color:
                          (d.resultadoEjercicio ?? 0) < 0
                            ? DIVERGENTE.negativo
                            : DIVERGENTE.positivo,
                      },
                      {
                        etiqueta: "Resultado de explotación",
                        valor: fmtEurosSigned(d.resultadoExplotacion),
                      },
                    ];
                  }}
                />
              }
            />
            <Bar
              dataKey="resultadoEjercicio"
              name="Resultado del ejercicio"
              radius={3}
              activeBar={false}
              isAnimationActive={false}
            >
              {datos.map((d) => (
                <Cell
                  key={d.anio}
                  fill={
                    (d.resultadoEjercicio ?? 0) < 0
                      ? DIVERGENTE.negativo
                      : DIVERGENTE.positivo
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

