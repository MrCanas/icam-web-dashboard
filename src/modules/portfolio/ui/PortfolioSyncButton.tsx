"use client";

import { MaestroSyncButton } from "@/components/data/MaestroSyncButton";

/**
 * Sincronización a demanda del maestro de VEHÍCULOS. La mecánica está en
 * `MaestroSyncButton`, compartida con el maestro corporativo; aquí solo vive lo
 * que es propio de este maestro.
 */
export function PortfolioSyncButton() {
  return (
    <MaestroSyncButton
      endpoint="/api/cron/portfolio-sync"
      descripcion="la tabla de proyectos"
      unidad="proyectos"
    />
  );
}
