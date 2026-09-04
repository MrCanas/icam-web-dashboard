"use client";

import { Suspense, lazy } from "react";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { BarDatum, ProjectBarChartProps } from "@/modules/portfolio/ui/impl/ProjectBarChart";

export type { BarDatum, ProjectBarChartProps };

/** La misma fórmula que la implementación: el hueco debe medir exactamente igual. */
function alturaDe(data: BarDatum[]): number {
  return Math.max(280, data.length * 34);
}

/**
 * Cáscara de carga diferida de ProjectBarChart.
 *
 * recharts pesa 356 KB y estaba en el arranque de todas las páginas con
 * gráficas. Aquí se usa `lazy` + `Suspense` en vez de `next/dynamic` porque la
 * altura del hueco depende del número de barras, y el `loading` de
 * `next/dynamic` no recibe las props. El resto de gráficas, de altura fija, sí
 * usan `next/dynamic`.
 */
const Impl = lazy(() =>
  import("@/modules/portfolio/ui/impl/ProjectBarChart").then((m) => ({ default: m.ProjectBarChart })),
);

export function ProjectBarChart(props: ProjectBarChartProps) {
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
