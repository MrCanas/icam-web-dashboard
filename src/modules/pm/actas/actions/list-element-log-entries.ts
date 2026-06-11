"use server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchElementLogEntries } from "@/modules/pm/actas/data/actasRepository";
import { parseAsOfDateParam } from "@/modules/pm/actas/logic/operativo-asof";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

export type ListElementLogEntriesResult =
  | { ok: true; entries: ActasLogEntryItem[] }
  | { ok: false; error: string };


export async function listElementLogEntries(
  elementId: string,
  asOfDate?: string,
): Promise<ListElementLogEntriesResult> {
  const id = elementId.trim();
  if (!id) {
    return { ok: false, error: "elementId requerido" };
  }

  const ctx = await getCurrentUser();
  if (!ctx) {
    return { ok: false, error: "No autorizado" };
  }
  const { entries, error } = await fetchElementLogEntries(ctx, id, {
    asOfIsoDate,
  });
  if (error) {
    return { ok: false, error };
  }

  return { ok: true, entries };
}
