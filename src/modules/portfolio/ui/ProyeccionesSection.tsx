"use client";

import dynamic from "next/dynamic";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { ProyeccionesSectionProps } from "@/modules/portfolio/ui/impl/ProyeccionesSection";

export type { ProyeccionesSectionProps };

/**
 * Cáscara de carga diferida de ProyeccionesSection.
 *
 * No es una gráfica suelta sino el bloque final de Tendencias, con dos: el
 * vencimiento del pipeline y la captación objetivo. Por eso el hueco son dos
 * marcos con las alturas de cada una, y no uno.
 */
const Impl = dynamic(
  () =>
    import("@/modules/portfolio/ui/impl/ProyeccionesSection").then(
      (m) => m.ProyeccionesSection,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 sm:space-y-4">
        <ChartFrame
          title="Proyección del pipeline"
          bodyClassName="h-[260px] w-full sm:h-[300px] min-w-0"
          titleClassName="text-base font-semibold text-text-primary"
        />
        <ChartFrame bodyClassName="h-[260px] w-full sm:h-[300px] min-w-0" />
      </div>
    ),
  },
);

export function ProyeccionesSection(props: ProyeccionesSectionProps) {
  return <Impl {...props} />;
}
