"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BloqueGrafica, SinDatos } from "@/components/charts/BloqueGrafica";
import { EJE, GRID, MARGEN, SERIE } from "@/components/charts/tokens";
import { fmtEurosCompact, fmtInt, fmtPct } from "@/lib/formatters";
import { capitalDe } from "@/modules/portfolio/inversores/logic/inversoresModel";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { payloadDe } from "@/modules/portfolio/inversores/ui/charts/payload";
import type { CuentaInversion } from "@/modules/portfolio/inversores/types";

interface Props {
  topCuentas: CuentaInversion[];
  /** Para poder decir qué parte del total representan las diez primeras. */
  totalComprometido: number;
  onAbrir: (cuenta: CuentaInversion) => void;
}

interface Fila {
  zohoId: string;
  nombre: string;
  capital: number;
  numContactos: number;
}

/**
 * Las diez cuentas con más capital: cómo de concentrado está el dinero.
 *
 * Barras horizontales porque los nombres de las cuentas son largos y en
 * vertical se cortan o se giran. El click salta directo al nivel 2 —los
 * contactos de esa cuenta— porque una barra ya ES una cuenta y pasar por una
 * lista de un elemento sería un paso de más.
 */
export function TopCuentasChart({ topCuentas, totalComprometido, onAbrir }: Props) {
  const filas: Fila[] = topCuentas.map((cuenta) => ({
    zohoId: cuenta.zohoId,
    nombre: cuenta.nombre,
    capital: capitalDe(cuenta),
    numContactos: cuenta.contactos.length,
  }));
  const porCuenta = new Map(topCuentas.map((c) => [c.zohoId, c]));
  const suma = filas.reduce((acc, f) => acc + f.capital, 0);
  const cuota = totalComprometido > 0 ? suma / totalComprometido : null;

  return (
    <BloqueGrafica
      titulo="Concentración: 10 mayores cuentas"
      subtitulo={
        cuota === null
          ? "Por capital comprometido"
          : `Reúnen el ${fmtPct(cuota)} del capital comprometido`
      }
      nota="Pulsa una barra para ver los contactos de esa cuenta."
    >
      {filas.length === 0 ? (
        <SinDatos mensaje="Todavía no hay cuentas de inversión sincronizadas." />
      ) : (
        <div className="h-[300px] min-w-0 sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filas} layout="vertical" margin={MARGEN}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis
                type="number"
                stroke={EJE}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => fmtEurosCompact(Number(v))}
              />
              <YAxis
                type="category"
                dataKey="nombre"
                stroke={EJE}
                tick={{ fontSize: 10 }}
                width={140}
                interval={0}
              />
              <Tooltip
                cursor={false}
                content={
                  <DrilldownTooltip
                    heading={(payload) => payloadDe<Fila>(payload[0])?.nombre ?? ""}
                    rows={(payload) => {
                      const f = payloadDe<Fila>(payload[0]);
                      return [
                        { label: "Capital", value: fmtEurosCompact(f?.capital ?? 0), color: SERIE.uno },
                        {
                          label: f?.numContactos === 1 ? "Contacto" : "Contactos",
                          value: fmtInt(f?.numContactos ?? 0),
                        },
                      ];
                    }}
                    hint="Click para ver sus contactos"
                  />
                }
              />
              <Bar
                dataKey="capital"
                name="Capital"
                fill={SERIE.uno}
                radius={[0, 3, 3, 0]}
                activeBar={false}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(entry) => {
                  const fila = payloadDe<Fila>(entry);
                  const cuenta = fila ? porCuenta.get(fila.zohoId) : undefined;
                  if (cuenta) onAbrir(cuenta);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </BloqueGrafica>
  );
}
