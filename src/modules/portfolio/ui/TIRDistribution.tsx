"use client";

import dynamic from "next/dynamic";

import { ChartFrame } from "@/components/ui/ChartFrame";
import type { TIRDistributionProps } from "@/modules/portfolio/ui/impl/TIRDistribution";

export type { TIRDistributionProps };

/**
 * Cáscara de carga diferida de TIRDistribution.
 *
 * recharts pesa 356 KB y estaba en el arranque de todas las páginas con
 * gráficas. El `dynamic` va aquí, dentro de un componente cliente, y no en la
 * página: la documentación de esta versión dice que un Server Component que
 * importa dinámicamente un Client Component NO parte nada, y que `ssr: false`
 * solo funciona dentro de clientes. Las páginas siguen importando este fichero
 * con la misma firma, así que ninguna cambia.
 */
const Impl = dynamic(
  () => import("@/modules/portfolio/ui/impl/TIRDistribution").then((m) => m.TIRDistribution),
  {
    ssr: false,
    loading: () => (
      <ChartFrame title={"Distribución de TIR"} bodyClassName="h-[240px] w-full sm:h-[280px] min-w-0" />
    ),
  },
);

export function TIRDistribution(props: TIRDistributionProps) {
  return <Impl {...props} />;
}
