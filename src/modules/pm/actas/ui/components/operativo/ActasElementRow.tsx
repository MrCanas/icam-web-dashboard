"use client";

import { useState } from "react";

import {
  truncateEntryPreview,
  formatTimelineRange,
  OPERATIVO_ROW_GRID,
} from "@/modules/pm/actas/logic/element-display";
import {
  ELEMENT_STATUS_LABEL,
  ELEMENT_STATUS_STYLE,
} from "@/modules/pm/actas/logic/element-status";
import { formatRelativeEntryDate } from "@/modules/pm/actas/logic/actas-time";
import type { ActasOperativoElement, ElementStatus } from "@/modules/pm/actas/types";

import { ActasAddLogEntryPanel } from "./ActasAddLogEntryPanel";
import { ActasElementHistoryPanel } from "./ActasElementHistoryPanel";
import { ActasOwnerAvatars } from "./ActasOwnerAvatars";

interface ActasElementRowProps {
  element: ActasOperativoElement;
  projectCode: string;
  currentAuthUserId: string | null;
  depth?: number;
}

const INDENT_PX = 24;

export function ActasElementRow({
  element,
  projectCode,
  currentAuthUserId,
  depth = 0,
}: ActasElementRowProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [historyReloadNonce, setHistoryReloadNonce] = useState(0);
  const [displayStatus, setDisplayStatus] = useState<ElementStatus>(
    element.status,
  );
  const [lastPreview, setLastPreview] = useState<string | null>(
    element.lastEntryContent,
  );
  const [lastDate, setLastDate] = useState<string | null>(element.lastEntryDate);

  const statusStyle = ELEMENT_STATUS_STYLE[displayStatus];
  const timeline = formatTimelineRange(
    element.timelineStart,
    element.timelineEnd,
  );
  const entryPreview = lastPreview ? truncateEntryPreview(lastPreview) : null;
  const entryFull = lastPreview?.trim() ?? "";
  const relativeDate = formatRelativeEntryDate(lastDate);
  const rowIndent = depth * INDENT_PX;
  const isSubElement = depth > 0;

  return (
    <>
      <div className="border-b border-subtle/40">
        <div
          className={`${OPERATIVO_ROW_GRID} px-4 py-2 transition-colors ${
            isSubElement
              ? "bg-page/30 hover:bg-page/50"
              : "bg-card hover:bg-page/60"
          } ${historyOpen || addOpen ? "bg-page/40" : ""}`}
        >
          <div
            className={`flex min-w-0 items-center gap-1 ${
              isSubElement ? "border-l-2 border-icam-900/20 pl-2" : ""
            }`}
            style={{ paddingLeft: rowIndent }}
          >
            {isSubElement ? (
              <span
                className="shrink-0 text-text-muted/60 text-xs select-none"
                aria-hidden
              >
                └
              </span>
            ) : null}
            <span
              className={`truncate text-text-body ${
                isSubElement ? "text-sm" : "text-sm font-medium"
              }`}
              title={element.name}
            >
              {element.name}
            </span>
          </div>

          <ActasOwnerAvatars owners={element.owners} />

          <span
            className="justify-self-start rounded px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
            style={{
              backgroundColor: statusStyle.bg,
              color: statusStyle.text,
            }}
          >
            {ELEMENT_STATUS_LABEL[displayStatus]}
          </span>

          <span
            className="text-xs text-text-body truncate"
            title={timeline ?? undefined}
          >
            {timeline ?? <span className="text-text-muted">—</span>}
          </span>

          <span
            className="min-w-0 text-xs text-text-body truncate cursor-default"
            title={entryFull.length > 0 ? entryFull : undefined}
          >
            {entryPreview ?? <span className="text-text-muted">—</span>}
          </span>

          <span className="text-xs text-text-muted whitespace-nowrap">
            {lastDate ? relativeDate : "—"}
          </span>

          <div className="justify-self-end flex flex-col items-end gap-0.5">
            <button
              type="button"
              className="text-xs font-medium text-icam-900 hover:text-icam-gold whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                setHistoryOpen((v) => !v);
              }}
              aria-expanded={historyOpen}
            >
              {historyOpen ? "▴ Histórico" : "▾ Histórico"}
            </button>
            <button
              type="button"
              className="text-[11px] text-text-muted hover:text-icam-900 whitespace-nowrap"
              onClick={(e) => {
                e.stopPropagation();
                setAddOpen(true);
              }}
            >
              + Añadir entrada
            </button>
          </div>
        </div>
      </div>

      {addOpen ? (
        <ActasAddLogEntryPanel
          elementId={element.id}
          currentStatus={displayStatus}
          indentPx={rowIndent + (isSubElement ? 8 : 0)}
          onCancel={() => setAddOpen(false)}
          onSaved={({ entry, elementStatus }) => {
            setAddOpen(false);
            setLastPreview(entry.content);
            setLastDate(entry.entryDate);
            setDisplayStatus(elementStatus);
            setHistoryReloadNonce((n) => n + 1);
            setHistoryOpen(true);
          }}
        />
      ) : null}

      {historyOpen ? (
        <ActasElementHistoryPanel
          elementId={element.id}
          elementName={element.name}
          projectCode={projectCode}
          currentAuthUserId={currentAuthUserId}
          indentPx={rowIndent + (isSubElement ? 8 : 0)}
          reloadNonce={historyReloadNonce}
          onLastEntryChange={(latest) => {
            setLastPreview(latest?.content ?? null);
            setLastDate(latest?.entryDate ?? null);
          }}
        />
      ) : null}

      {element.children.map((child) => (
        <ActasElementRow
          key={child.id}
          element={child}
          projectCode={projectCode}
          currentAuthUserId={currentAuthUserId}
          depth={depth + 1}
        />
      ))}

      {element.canHaveSubelements ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 border-b border-subtle/40 bg-card/80 px-4 py-2 text-sm text-icam-900/75 hover:bg-icam-900/5 transition-colors"
          style={{ paddingLeft: rowIndent + 16 }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-lg leading-none font-light" aria-hidden>
            +
          </span>
          Sub-elemento
        </button>
      ) : null}
    </>
  );
}
