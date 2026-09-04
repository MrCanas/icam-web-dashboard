"use client";

import { Suspense, lazy } from "react";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { GroupedBarDatum, ProjectGroupedBarChartProps } from "@/modules/portfolio/ui/impl/ProjectGroupedBarChart";

export type { GroupedBarDatum, ProjectGroupedBarChartProps };

/** La misma fórmula que la implementación: el hueco debe medir exactamente igual. */
function alturaDe(data: GroupedBarDatum[]): number {
  return Math.max(280, data.length * 42);
}

/**
 * Cáscara de carga diferida de ProjectGroupedBarChart.
 *
 * recharts pesa 356 KB y estaba en el arranque de todas las páginas con
 * gráficas. Aquí se usa `lazy` + `Suspense` en vez de `next/dynamic` porque la
 * altura del hueco depende del número de barras, y el `loading` de
 * `next/dynamic` no recibe las props. El resto de gráficas, de altura fija, sí
 * usan `next/dynamic`.
 */
const Impl = lazy(() =>
  import("@/modules/portfolio/ui/impl/ProjectGroupedBarChart").then((m) => ({ default: m.ProjectGroupedBarChart })),
);

export function ProjectGroupedBarChart(props: ProjectGroupedBarChartProps) {
  return (
    <Suspense
      fallback={
        <ChartFrame
          title={props.title}
          bodyClassName="w-full min-w-0"
          bodyStyle={{ height: alturaDe(props.data) }}
        />
      }
    >
      <Impl {...props} />
    </Suspense>
  );
}
