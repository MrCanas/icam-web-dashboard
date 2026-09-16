"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BloqueGrafica, SinDatos } from "@/components/charts/BloqueGrafica";
import { DIVERGENTE, EJE, EJE_Y_ANCHO, GRID, MARGEN, SERIE } from "@/components/charts/tokens";
import { fmtEurosCompact, fmtInt } from "@/lib/formatters";
import { DrilldownTooltip } from "@/modules/portfolio/ui/charts/DrilldownTooltip";
import { payloadDe } from "@/modules/portfolio/inversores/ui/charts/payload";
import type { PuntoTrimestre } from "@/modules/portfolio/inversores/types";

interface Props {
  porTrimestre: PuntoTrimestre[];
  onAbrir: (punto: PuntoTrimestre) => void;
}

/**
 * Aportes y repartos por trimestre, y cuánto capital sigue puesto.
 *
 * Divergente —aportes hacia arriba, repartos hacia abajo— porque son flujos de
 * signo contrario y apilarlos escondería justo lo que interesa: cuándo el
 * dinero empieza a volver.
 *
 * El acumulado va en una TIRA DE APOYO debajo, compartiendo `EJE_Y_ANCHO` y
 * `MARGEN` para que los dos ejes X queden alineados al píxel. No es un capricho
 * de maquetación: el doble eje Y está prohibido en las gráficas del portal,
 * porque deja comparar dos escalas distintas como si fueran la misma.
 */
export function AportesRepartosChart({ porTrimestre, onAbrir }: Props) {
  if (porTrimestre.length === 0) {
    return (
      <BloqueGrafica titulo="Aportes y repartos por trimestre" ancho>
        <SinDatos mensaje="No hay flujos con fecha y tipo reconocido." />
      </BloqueGrafica>
    );
  }

  const abrir = (entry: unknown) => {
    const punto = payloadDe<PuntoTrimestre>(entry);
    if (punto && punto.numCuentas > 0) onAbrir(punto);
  };

  return (
    <BloqueGrafica
      titulo="Aportes y repartos por trimestre"
      subtitulo="Barras: movimientos del trimestre · Tira inferior: capital que sigue puesto"
      nota="Los repartos se pintan hacia abajo. Pulsa una barra para ver las cuentas con movimiento ese trimestre."
      ancho
    >
      <div className="h-[240px] min-w-0 sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={porTrimestre} margin={MARGEN} stackOffset="sign">
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="periodo" stroke={EJE} tick={{ fontSize: 10 }} />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => fmtEurosCompact(Math.abs(Number(v)))}
            />
            <ReferenceLine y={0} stroke={EJE} />
            <Tooltip
              cursor={false}
              content={
                <DrilldownTooltip
                  heading={(payload) => payloadDe<PuntoTrimestre>(payload[0])?.periodo ?? ""}
                  rows={(payload) => {
                    const p = payloadDe<PuntoTrimestre>(payload[0]);
                    return [
                      {
                        label: "Aportes",
                        value: fmtEurosCompact(p?.aportes ?? 0),
                        color: DIVERGENTE.positivo,
                      },
                      {
                        // Guardado en negativo para pintarlo hacia abajo; en el
                        // tooltip se lee en positivo, que es como se habla de él.
                        label: "Repartos",
                        value: fmtEurosCompact(Math.abs(p?.repartos ?? 0)),
                        color: DIVERGENTE.negativo,
                      },
                      { label: "Sigue puesto", value: fmtEurosCompact(p?.netoAcumulado ?? 0) },
                      {
                        label: p?.numCuentas === 1 ? "Cuenta" : "Cuentas",
                        value: fmtInt(p?.numCuentas ?? 0),
                      },
                    ];
                  }}
                  hint={(payload) =>
                    (payloadDe<PuntoTrimestre>(payload[0])?.numCuentas ?? 0) > 0
                      ? "Click para ver las cuentas"
                      : false
                  }
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar
              dataKey="aportes"
              stackId="flujo"
              name="Aportes"
              fill={DIVERGENTE.positivo}
              activeBar={false}
              isAnimationActive={false}
              cursor="pointer"
              onClick={abrir}
            />
            <Bar
              dataKey="repartos"
              stackId="flujo"
              name="Repartos"
              fill={DIVERGENTE.negativo}
              activeBar={false}
              isAnimationActive={false}
              cursor="pointer"
              onClick={abrir}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[96px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={porTrimestre} margin={MARGEN}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            {/* Sin etiquetas en el eje X: son las mismas de la gráfica de
                arriba y repetirlas solo añade ruido. El ancho del eje Y sí se
                mantiene, que es lo que alinea las dos. */}
            <XAxis dataKey="periodo" stroke={EJE} tick={false} height={1} />
            <YAxis
              width={EJE_Y_ANCHO}
              stroke={EJE}
              tick={{ fontSize: 9 }}
              tickFormatter={(v) => fmtEurosCompact(Number(v))}
            />
            <Area
              type="monotone"
              dataKey="netoAcumulado"
              name="Sigue puesto"
              stroke={SERIE.uno}
              fill={SERIE.uno}
              fillOpacity={0.15}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </BloqueGrafica>
  );
}
