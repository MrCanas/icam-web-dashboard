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
import { fmtEurosCompact, fmtInt } from "@/lib/formatters";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { payloadDe } from "@/modules/portfolio/inversores/ui/charts/payload";
import type { TramoInversion } from "@/modules/portfolio/inversores/types";

interface Props {
  tramos: TramoInversion[];
  onAbrir: (tramo: TramoInversion) => void;
}

/**
 * Cuántas cuentas de inversión hay en cada tramo de capital.
 *
 * Es la gráfica que motiva todo el drill-down: el tooltip dice «12 cuentas» y
 * el click enseña las 12, con sus contactos a un paso.
 */
export function CuentasPorTramoChart({ tramos, onAbrir }: Props) {
  const hayDatos = tramos.some((t) => t.numCuentas > 0);

  return (
    <BloqueGrafica
      titulo="Cuentas por tramo de inversión"
      subtitulo="Por capital comprometido; si no consta, por lo aportado"
      nota="Pulsa una barra para ver las cuentas de ese tramo."
    >
      {!hayDatos ? (
        <SinDatos mensaje="Todavía no hay cuentas de inversión sincronizadas." />
      ) : (
        <div className="h-[260px] min-w-0 sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tramos} margin={MARGEN}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="etiqueta" stroke={EJE} tick={{ fontSize: 10 }} />
              <YAxis
                stroke={EJE}
                tick={{ fontSize: 10 }}
                allowDecimals={false}
                tickFormatter={(v) => fmtInt(Number(v))}
              />
              <Tooltip
                cursor={false}
                content={
                  <DrilldownTooltip
                    rows={(payload) => {
                      const tramo = payloadDe<TramoInversion>(payload[0]);
                      return [
                        {
                          label: tramo?.numCuentas === 1 ? "Cuenta" : "Cuentas",
                          value: fmtInt(tramo?.numCuentas ?? 0),
                          color: SERIE.uno,
                        },
                        { label: "Capital", value: fmtEurosCompact(tramo?.total ?? 0) },
                      ];
                    }}
                    // Un tramo vacío no lleva a ninguna parte: no prometas un
                    // click que abriría un modal en blanco.
                    hint={(payload) =>
                      (payloadDe<TramoInversion>(payload[0])?.numCuentas ?? 0) > 0
                        ? "Click para ver las cuentas"
                        : false
                    }
                  />
                }
              />
              <Bar
                dataKey="numCuentas"
                name="Cuentas"
                fill={SERIE.uno}
                radius={[3, 3, 0, 0]}
                activeBar={false}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(entry) => {
                  const tramo = payloadDe<TramoInversion>(entry);
                  if (tramo && tramo.numCuentas > 0) onAbrir(tramo);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </BloqueGrafica>
  );
}
