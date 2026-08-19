"use server";

import { changeElementStatus } from "@/modules/pm/actas/actions/change-element-status";
import type { ElementStatus } from "@/modules/pm/actas/types";

export type BulkChangeElementStatusInput = {
  elementIds: string[];
  newStatus: ElementStatus;
};

export type BulkChangeElementStatusResult =
  | { ok: true; updated: number; failed: number }
  | { ok: false; error: string };

export async function bulkChangeElementStatus(
  input: BulkChangeElementStatusInput,
): Promise<BulkChangeElementStatusResult> {
  const elementIds = [...new Set(input.elementIds.map((id) => id.trim()).filter(Boolean))];

  if (elementIds.length === 0) {
    return { ok: false, error: "No hay elementos seleccionados" };
  }

  // Concurrente en vez de secuencial: los cambios de estado son independientes
  // entre elementos, así que no hay razón para esperar uno tras otro. El array
  // de resultados conserva el orden de entrada, así que «primer error» sigue
  // siendo el primero de la selección.
  const results = await Promise.all(
    elementIds.map((elementId) =>
      changeElementStatus({ elementId, newStatus: input.newStatus }),
    ),
  );

  let updated = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const result of results) {
    if (!result.ok) {
      failed += 1;
      firstError ??= result.error;
      continue;
    }
    if (!result.noop) {
      updated += 1;
    }
  }

  if (failed === elementIds.length && firstError) {
    return { ok: false, error: firstError };
  }

  return { ok: true, updated, failed };
}
