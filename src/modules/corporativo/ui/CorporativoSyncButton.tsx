"use client";

import { MaestroSyncButton } from "@/components/data/MaestroSyncButton";

/**
 * Sincronización a demanda del maestro CORPORATIVO. Comparte mecánica con la del
 * portfolio y apunta a su propio cron: los dos maestros fallan por separado y se
 * arreglan por separado.
 */
export function CorporativoSyncButton() {
  return (
    <MaestroSyncButton
      endpoint="/api/cron/corporativo-sync"
      descripcion="la tabla de periodos corporativos"
      unidad="periodos"
    />
  );
}
