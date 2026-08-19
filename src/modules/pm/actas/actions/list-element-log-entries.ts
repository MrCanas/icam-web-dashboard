"use server";

import { requirePmReadContext } from "@/modules/pm/actas/actions/require-pm-read";
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

  const access = await requirePmReadContext();
  if (!access.ok) return access;
  const ctx = access.ctx;

  const asOfIsoDate = parseAsOfDateParam(asOfDate?.trim()) ?? undefined;
  const { entries, error } = await fetchElementLogEntries(ctx, id, {
    asOfIsoDate,
  });
  if (error) {
    return { ok: false, error };
  }

  return { ok: true, entries };
}
