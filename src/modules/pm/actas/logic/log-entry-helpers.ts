import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

/** Entrada activa más reciente por entry_date. */
export function pickLatestActiveEntry(
  entries: ActasLogEntryItem[],
): ActasLogEntryItem | null {
  const active = entries.filter((e) => e.deletedAt == null);
  if (active.length === 0) return null;
  return active.reduce((best, e) =>
    new Date(e.entryDate).getTime() > new Date(best.entryDate).getTime() ? e : best,
  );
}
