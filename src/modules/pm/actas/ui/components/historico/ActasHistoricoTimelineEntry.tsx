import { formatActaEntryDateTime } from "@/modules/pm/actas/logic/actas-time";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

import { ActasLogEntryStatusChip } from "../operativo/ActasLogEntryStatusChip";

interface ActasHistoricoTimelineEntryProps {
  entry: ActasLogEntryItem;
  deleted?: boolean;
}

export function ActasHistoricoTimelineEntry({
  entry,
  deleted = false,
}: ActasHistoricoTimelineEntryProps) {
  const hasStatusChange =
    entry.statusBefore != null && entry.statusAfter != null;
  const authorLabel =
    entry.author?.label ?? (entry.authorId ? "Usuario" : "Sin autor");

  return (
    <div className="flex gap-4 md:gap-6">
      <div className="w-28 shrink-0 text-right md:w-32">
        <time
          dateTime={entry.entryDate}
          className={`block text-sm font-semibold leading-snug ${
            deleted ? "text-text-muted line-through" : "text-icam-900"
          }`}
        >
          {formatActaEntryDateTime(entry.entryDate)}
        </time>
      </div>
      <div className="relative flex-1 min-w-0 pb-8 border-l-2 border-subtle/50 pl-4 md:pl-6">
        <span
          className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-icam-900"
          aria-hidden
        />
        {hasStatusChange && !deleted ? (
          <div className="mb-2">
            <ActasLogEntryStatusChip
              statusBefore={entry.statusBefore!}
              statusAfter={entry.statusAfter!}
            />
          </div>
        ) : null}
        <p
          className={`whitespace-pre-wrap text-sm leading-relaxed ${
            deleted
              ? "text-text-muted line-through"
              : "text-text-primary"
          }`}
        >
          {entry.content}
        </p>
        <p className="mt-2 text-xs text-text-muted">
          {authorLabel}
          {deleted && entry.deletedAt ? (
            <span className="ml-2 text-red-600/80">
              · Borrada el {formatActaEntryDateTime(entry.deletedAt)}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

interface ActasHistoricoGapSeparatorProps {
  days: number;
}

export function ActasHistoricoGapSeparator({
  days,
}: ActasHistoricoGapSeparatorProps) {
  return (
    <div className="flex items-center gap-3 py-2 pl-28 md:pl-32">
      <div className="flex-1 border-t border-dashed border-subtle/60" />
      <span className="shrink-0 text-xs font-medium text-text-muted">
        ↓ {days} días sin actividad ↓
      </span>
      <div className="flex-1 border-t border-dashed border-subtle/60" />
    </div>
  );
}
