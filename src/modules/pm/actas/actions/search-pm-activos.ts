"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import {
  searchPmActivos,
  type PmActivoOption,
} from "@/modules/pm/actas/data/projectTemplateRepository";

export async function searchPmActivosAction(
  query: string,
): Promise<{ ok: true; items: PmActivoOption[] } | { ok: false; error: string }> {
  const ctx = await requireCurrentUser();
  try {
    const items = await searchPmActivos(ctx, query);
    return { ok: true, items };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al buscar activos";
    return { ok: false, error: message };
  }
}
