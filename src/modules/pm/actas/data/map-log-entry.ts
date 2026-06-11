import { toElementStatus } from "@/modules/pm/actas/logic/element-status";
import type { ActasElementOwner, ActasLogEntryItem } from "@/modules/pm/actas/types";

export type LogEntryRow = {
  id: string;
  content: string;
  entry_date: string;
  deleted_at: string | null;
  status_before: string | null;
  status_after: string | null;
  author_id: string | null;
  source?: string | null;
  edited_at?: string | null;
};

export function mapLogEntryRow(
  row: LogEntryRow,
  userDisplayMap: Map<string, ActasElementOwner>,
): ActasLogEntryItem {
  const authorId = row.author_id ?? null;

  return {
    id: row.id,
    content: row.content,
    entryDate: row.entry_date,
    deletedAt: row.deleted_at ?? null,
    statusBefore:
      row.status_before != null ? toElementStatus(row.status_before) : null,
    statusAfter:
      row.status_after != null ? toElementStatus(row.status_after) : null,
    authorId,
    source: row.source ?? null,
    editedAt: row.edited_at ?? null,
    author: authorId ? (userDisplayMap.get(authorId) ?? null) : null,
  };
}
