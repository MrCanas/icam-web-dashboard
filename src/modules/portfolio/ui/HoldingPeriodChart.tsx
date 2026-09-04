"use client";

import dynamic from "next/dynamic";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { HoldingPeriodChartProps } from "@/modules/portfolio/ui/impl/HoldingPeriodChart";

export type { HoldingPeriodChartProps };

/**
 * Cáscara de carga diferida de HoldingPeriodChart.
 *
 * recharts pesa 356 KB y estaba en el arranque de todas las páginas con
 * gráficas. El `dynamic` va aquí, dentro de un componente cliente, y no en la
 * página: la documentación de esta versión dice que un Server Component que
 * importa dinámicamente un Client Component NO parte nada, y que `ssr: false`
 * solo funciona dentro de clientes. Las páginas siguen importando este fichero
 * con la misma firma, así que ninguna cambia.
 */
const Impl = dynamic(
  () => import("@/modules/portfolio/ui/impl/HoldingPeriodChart").then((m) => m.HoldingPeriodChart),
  {
    ssr: false,
    loading: () => (
      <ChartFrame title={"Holding Period por Proyecto"} bodyClassName="h-[260px] w-full sm:h-[320px] min-w-0" />
    ),
  },
);

export function HoldingPeriodChart(props: HoldingPeriodChartProps) {
  return <Impl {...props} />;
}
