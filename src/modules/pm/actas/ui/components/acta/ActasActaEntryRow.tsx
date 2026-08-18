"use client";

import { useState } from "react";

import { actasElementPermalinkUrl } from "@/modules/pm/actas/logic/actas-paths";
import { formatActaEntryDateTime } from "@/modules/pm/actas/logic/actas-time";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

import { ActasLogEntryStatusChip } from "../operativo/ActasLogEntryStatusChip";
import { useActasBasePath } from "@/modules/pm/actas/ui/ActasBasePathContext";

interface ActasActaEntryRowProps {
  entry: ActasLogEntryItem;
  elementId: string;
  projectCode: string;
}

export function ActasActaEntryRow({
  entry,
  elementId,
  projectCode,
}: ActasActaEntryRowProps) {
  const basePath = useActasBasePath();
  const [copied, setCopied] = useState(false);
  const hasStatusChange =
    entry.statusBefore != null && entry.statusAfter != null;
  const authorLabel =
    entry.author?.label ?? (entry.authorId ? "Usuario" : "Sin autor");

  const copyPermalink = async () => {
    const url = actasElementPermalinkUrl(projectCode, elementId, {
      origin: window.location.origin,
      basePath,
    });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <article className="group/entry relative border-l-2 border-subtle/50 pl-4 py-3 text-sm">
      <button
        type="button"
        title={copied ? "Copiado" : "Copiar permalink del elemento"}
        aria-label="Copiar permalink del elemento"
        onClick={() => void copyPermalink()}
        className="absolute right-0 top-2 opacity-0 group-hover/entry:opacity-100 transition-opacity rounded px-1.5 py-0.5 text-xs text-text-muted hover:bg-page hover:text-icam-900"
      >
        {copied ? "✓" : "🔗"}
      </button>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted pr-8">
        <time dateTime={entry.entryDate}>
          {formatActaEntryDateTime(entry.entryDate)}
        </time>
        <span className="font-medium text-text-primary">{authorLabel}</span>
        {hasStatusChange ? (
          <ActasLogEntryStatusChip
            statusBefore={entry.statusBefore!}
            statusAfter={entry.statusAfter!}
          />
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-text-primary leading-relaxed">
        {entry.content}
      </p>
    </article>
  );
}
