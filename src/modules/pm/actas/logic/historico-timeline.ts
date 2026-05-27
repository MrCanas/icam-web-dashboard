import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

export type HistoricoTimelineItem =
  | { kind: "entry"; entry: ActasLogEntryItem }
  | { kind: "gap"; days: number };

const MS_PER_DAY = 86_400_000;

export function buildHistoricoTimelineItems(
  entriesAsc: ActasLogEntryItem[],
): HistoricoTimelineItem[] {
  const items: HistoricoTimelineItem[] = [];

  for (let i = 0; i < entriesAsc.length; i++) {
    const entry = entriesAsc[i]!;
    if (i > 0) {
      const prev = new Date(entriesAsc[i - 1]!.entryDate).getTime();
      const curr = new Date(entry.entryDate).getTime();
      if (!Number.isNaN(prev) && !Number.isNaN(curr)) {
        const days = Math.floor((curr - prev) / MS_PER_DAY);
        if (days > 30) {
          items.push({ kind: "gap", days });
        }
      }
    }
    items.push({ kind: "entry", entry });
  }

  return items;
}

export function countDeletedEntries(entries: ActasLogEntryItem[]): number {
  return entries.filter((e) => e.deletedAt != null).length;
}
