"use client";

import { Suspense, lazy } from "react";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { ProjectSharePieProps, ShareDatum } from "@/modules/portfolio/ui/impl/ProjectSharePie";

export type { ProjectSharePieProps, ShareDatum };

/**
 * Cáscara de carga diferida de ProjectSharePie. Como en DonutChart, el título
 * viene por props, así que el hueco se monta con `lazy` + `Suspense`.
 */
const Impl = lazy(() =>
  import("@/modules/portfolio/ui/impl/ProjectSharePie").then((m) => ({
    default: m.ProjectSharePie,
  })),
);

export function ProjectSharePie(props: ProjectSharePieProps) {
  return (
    <Suspense
      fallback={
        <ChartFrame
          title={props.title}
          bodyClassName="h-[200px] w-full sm:w-1/2 sm:max-w-[240px] sm:h-[220px] mx-auto sm:mx-0"
        />
      }
    >
      <Impl {...props} />
    </Suspense>
  );
}
