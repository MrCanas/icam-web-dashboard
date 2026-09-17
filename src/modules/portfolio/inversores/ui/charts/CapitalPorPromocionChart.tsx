"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BloqueGrafica, SinDatos } from "@/components/charts/BloqueGrafica";
import { EJE, EJE_Y_ANCHO, GRID, MARGEN, SERIE } from "@/components/charts/tokens";
import { fmtEurosCompact, fmtInt } from "@/lib/formatters";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { payloadDe } from "@/modules/portfolio/inversores/ui/charts/payload";
import type { PuntoPromocion } from "@/modules/portfolio/inversores/types";

interface Props {
  porPromocion: PuntoPromocion[];
  onAbrir: (promocion: PuntoPromocion) => void;
}

/** Más de esto y las etiquetas del eje dejan de leerse. */
const MAXIMO = 12;

/**
 * Cuánto capital hay puesto en cada promoción, y cuánto queda por desembolsar.
 *
 * Dos series y no tres: es el tope que fija la paleta compartida. Lo aportado y
 * lo pendiente se apilan porque juntos son el compromiso total, que es la
 * lectura que interesa.
 */
export function CapitalPorPromocionChart({ porPromocion, onAbrir }: Props) {
  const datos = porPromocion.slice(0, MAXIMO);
  const restantes = porPromocion.length - datos.length;

  return (
    <BloqueGrafica
      titulo="Capital por promoción"
      subtitulo={
        restantes > 0
          ? `Las ${MAXIMO} mayores por compromiso; quedan ${fmtInt(restantes)} fuera`
          : "Por compromiso total"
      }
      nota="Pulsa una barra para ver las cuentas que participan en esa promoción."
      ancho
    >
      {datos.length === 0 ? (
        <SinDatos mensaje="Ninguna cuenta está vinculada todavía a una promoción." />
      ) : (
        <div className="h-[300px] min-w-0 sm:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={MARGEN}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis
                dataKey="nombre"
                stroke={EJE}
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={70}
              />
              <YAxis
                width={EJE_Y_ANCHO}
                stroke={EJE}
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => fmtEurosCompact(Number(v))}
              />
              <Tooltip
                cursor={false}
                content={
                  <DrilldownTooltip
                    heading={(payload) => payloadDe<PuntoPromocion>(payload[0])?.nombre ?? ""}
                    rows={(payload) => {
                      const p = payloadDe<PuntoPromocion>(payload[0]);
                      return [
                        { label: "Aportado", value: fmtEurosCompact(p?.aportado ?? 0), color: SERIE.uno },
                        { label: "Pendiente", value: fmtEurosCompact(p?.pendiente ?? 0), color: SERIE.dos },
                        {
                          label: p?.numCuentas === 1 ? "Cuenta" : "Cuentas",
                          value: fmtInt(p?.numCuentas ?? 0),
                        },
                      ];
                    }}
                    hint="Click para ver las cuentas"
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar
                dataKey="aportado"
                stackId="capital"
                name="Aportado"
                fill={SERIE.uno}
                activeBar={false}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(entry) => {
                  const p = payloadDe<PuntoPromocion>(entry);
                  if (p) onAbrir(p);
                }}
              />
              <Bar
                dataKey="pendiente"
                stackId="capital"
                name="Pendiente de desembolso"
                fill={SERIE.dos}
                radius={[3, 3, 0, 0]}
                activeBar={false}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(entry) => {
                  const p = payloadDe<PuntoPromocion>(entry);
                  if (p) onAbrir(p);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </BloqueGrafica>
  );
}
