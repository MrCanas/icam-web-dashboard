"use client";

import { Suspense, lazy } from "react";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { DonutChartProps } from "@/modules/portfolio/ui/impl/DonutChart";

export type { DonutChartProps };

/**
 * Cáscara de carga diferida de DonutChart.
 *
 * `lazy` + `Suspense` en vez de `next/dynamic` porque el título viene por props
 * y el `loading` de `next/dynamic` no las recibe: con él, la tarjeta aparecería
 * sin título y lo ganaría al llegar la gráfica, que es justo el parpadeo que
 * este hueco existe para evitar.
 */
const Impl = lazy(() =>
  import("@/modules/portfolio/ui/impl/DonutChart").then((m) => ({ default: m.DonutChart })),
);

export function DonutChart(props: DonutChartProps) {
  return (
    <Suspense
      fallback={
        <ChartFrame
          title={props.title}
          titleClassName="text-sm font-semibold text-text-primary mb-2 sm:mb-3"
          bodyClassName="h-[180px] w-full sm:w-1/2 sm:max-w-[240px] sm:h-[175px] mx-auto sm:mx-0"
        />
      }
    >
      <Impl {...props} />
    </Suspense>
  );
}
