"use client";

import dynamic from "next/dynamic";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { VintageTIRChartProps } from "@/modules/portfolio/ui/impl/VintageTIRChart";

export type { VintageTIRChartProps };

/**
 * Cáscara de carga diferida de VintageTIRChart.
 *
 * recharts pesa 356 KB y estaba en el arranque de todas las páginas con
 * gráficas. El `dynamic` va aquí, dentro de un componente cliente, y no en la
 * página: la documentación de esta versión dice que un Server Component que
 * importa dinámicamente un Client Component NO parte nada, y que `ssr: false`
 * solo funciona dentro de clientes. Las páginas siguen importando este fichero
 * con la misma firma, así que ninguna cambia.
 */
const Impl = dynamic(
  () => import("@/modules/portfolio/ui/impl/VintageTIRChart").then((m) => m.VintageTIRChart),
  {
    ssr: false,
    loading: () => (
      <ChartFrame title={"TIR Ponderada por Generación"} bodyClassName="h-[240px] w-full sm:h-[300px] min-w-0" />
    ),
  },
);

export function VintageTIRChart(props: VintageTIRChartProps) {
  return <Impl {...props} />;
}
