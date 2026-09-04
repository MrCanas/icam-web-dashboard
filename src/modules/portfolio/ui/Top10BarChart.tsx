"use client";

import dynamic from "next/dynamic";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { Top10BarChartProps } from "@/modules/portfolio/ui/impl/Top10BarChart";

export type { Top10BarChartProps };

/**
 * Cáscara de carga diferida de Top10BarChart.
 *
 * recharts pesa 356 KB y estaba en el arranque de todas las páginas con
 * gráficas. El `dynamic` va aquí, dentro de un componente cliente, y no en la
 * página: la documentación de esta versión dice que un Server Component que
 * importa dinámicamente un Client Component NO parte nada, y que `ssr: false`
 * solo funciona dentro de clientes. Las páginas siguen importando este fichero
 * con la misma firma, así que ninguna cambia.
 */
const Impl = dynamic(
  () => import("@/modules/portfolio/ui/impl/Top10BarChart").then((m) => m.Top10BarChart),
  {
    ssr: false,
    loading: () => (
      <ChartFrame title={"Top 10 proyectos por inversión"} bodyClassName="h-[300px] w-full sm:h-[340px] min-w-0"
        titleClassName={"text-base font-semibold text-text-primary mb-3 sm:mb-4"} />
    ),
  },
);

export function Top10BarChart(props: Top10BarChartProps) {
  return <Impl {...props} />;
}
