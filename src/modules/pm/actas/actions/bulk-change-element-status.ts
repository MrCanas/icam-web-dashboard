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

  let updated = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const elementId of elementIds) {
    const result = await changeElementStatus({
      elementId,
      newStatus: input.newStatus,
    });
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
