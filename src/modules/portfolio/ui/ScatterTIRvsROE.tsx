"use client";

import dynamic from "next/dynamic";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { ScatterTIRvsROEProps } from "@/modules/portfolio/ui/impl/ScatterTIRvsROE";

export type { ScatterTIRvsROEProps };

/**
 * Cáscara de carga diferida de ScatterTIRvsROE.
 *
 * recharts pesa 356 KB y estaba en el arranque de todas las páginas con
 * gráficas. El `dynamic` va aquí, dentro de un componente cliente, y no en la
 * página: la documentación de esta versión dice que un Server Component que
 * importa dinámicamente un Client Component NO parte nada, y que `ssr: false`
 * solo funciona dentro de clientes. Las páginas siguen importando este fichero
 * con la misma firma, así que ninguna cambia.
 */
const Impl = dynamic(
  () => import("@/modules/portfolio/ui/impl/ScatterTIRvsROE").then((m) => m.ScatterTIRvsROE),
  {
    ssr: false,
    loading: () => (
      <ChartFrame title={"TIR vs ROE - Tamaño por Inversión"} bodyClassName="h-[280px] w-full sm:h-[360px] min-w-0"
        titleClassName={"text-base font-semibold text-text-primary mb-3 sm:mb-4"} />
    ),
  },
);

export function ScatterTIRvsROE(props: ScatterTIRvsROEProps) {
  return <Impl {...props} />;
}
