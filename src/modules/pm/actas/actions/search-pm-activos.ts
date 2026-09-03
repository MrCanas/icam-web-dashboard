"use server";

import { requirePmReadContext } from "@/modules/pm/actas/actions/require-pm-read";
import {
  searchPmActivos,
  type PmActivoOption,
} from "@/modules/pm/actas/data/projectTemplateRepository";

export async function searchPmActivosAction(
  query: string,
): Promise<{ ok: true; items: PmActivoOption[] } | { ok: false; error: string }> {
  const access = await requirePmReadContext();
  if (!access.ok) return access;
  const ctx = access.ctx;
  try {
    const items = await searchPmActivos(ctx, query);
    return { ok: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al buscar activos";
    return { ok: false, error: message };
  }
}
