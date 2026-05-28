"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { countElementDescendants } from "@/modules/pm/actas/logic/count-element-descendants";
import {
  truncateEntryPreview,
  OPERATIVO_ROW_GRID,
} from "@/modules/pm/actas/logic/element-display";
import { ActasStatusPicker } from "./ActasStatusPicker";
import { formatRelativeEntryDate } from "@/modules/pm/actas/logic/actas-time";
import type { ActasLogEntryItem, ActasOperativoElement, ElementStatus } from "@/modules/pm/actas/types";

import { ActasAddLogEntryPanel } from "./ActasAddLogEntryPanel";
import { ActasAddSubelementPanel } from "./ActasAddSubelementPanel";
import { ActasArchiveElementModal } from "./ActasArchiveElementModal";
import { ActasElementHistoryPanel } from "./ActasElementHistoryPanel";
import { ActasElementQuickActions } from "./ActasElementQuickActions";
import { ActasOwnerPicker } from "./ActasOwnerPicker";
import { ActasTimelinePicker } from "./ActasTimelinePicker";

interface ActasElementRowProps {
  element: ActasOperativoElement;
  projectCode: string;
  currentAuthUserId: string | null;
  depth?: number;
  readOnly?: boolean;
  asOfDate?: string;
  onElementArchived?: (message: string) => void;
  onToast?: (message: string) => void;
}

const INDENT_PX = 20;

export function ActasElementRow({
  element,
  projectCode,
  currentAuthUserId,
  depth = 0,
  readOnly = false,
  asOfDate,
  onElementArchived,
  onToast,
}: ActasElementRowProps) {
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [historyReloadNonce, setHistoryReloadNonce] = useState(0);
  const [displayStatus, setDisplayStatus] = useState<ElementStatus>(
    element.status,
  );
  const [lastPreview, setLastPreview] = useState<string | null>(
    element.lastEntryContent,
  );
  const [lastDate, setLastDate] = useState<string | null>(element.lastEntryDate);
  const [owners, setOwners] = useState(element.owners);
  const [timelineStart, setTimelineStart] = useState<string | null>(
    element.timelineStart,
  );
  const [timelineEnd, setTimelineEnd] = useState<string | null>(
    element.timelineEnd,
  );

  useEffect(() => {
    setOwners(element.owners);
  }, [element.owners]);
  useEffect(() => {
    setTimelineStart(element.timelineStart);
    setTimelineEnd(element.timelineEnd);
  }, [element.timelineStart, element.timelineEnd]);

  const rowStatus = readOnly ? element.status : displayStatus;
  const effectivePreview = readOnly ? element.lastEntryContent : lastPreview;
  const entryPreviewText = effectivePreview
    ? truncateEntryPreview(effectivePreview)
    : null;
  const entryFull = effectivePreview?.trim() ?? "";
  const relativeDate = formatRelativeEntryDate(
    readOnly ? element.lastEntryDate : lastDate,
  );
  const rowIndent = depth * INDENT_PX;
  const isSubElement = depth > 0;
  const descendantCount = countElementDescendants(element);
  const expanded = historyOpen || addOpen || subOpen;

  const handleStatusChange = (
    newStatus: ElementStatus,
    entry: ActasLogEntryItem | null,
  ) => {
    setDisplayStatus(newStatus);
    if (entry) {
      setLastPreview(entry.content);
      setLastDate(entry.entryDate);
      setHistoryReloadNonce((n) => n + 1);
    }
  };

  return (
    <>
      <div className="border-b border-subtle/40">
        <div
          className={`group/row ${OPERATIVO_ROW_GRID} px-3 py-1.5 min-h-9 transition-colors ${
            isSubElement
              ? "bg-page/30 hover:bg-page/50"
              : "bg-card hover:bg-page/60"
          } ${expanded ? "bg-page/40" : ""}`}
        >
          <div
            className={`flex min-w-0 items-center gap-1 ${
              isSubElement ? "border-l-2 border-icam-900/20 pl-1.5" : ""
            }`}
            style={{ paddingLeft: rowIndent }}
          >
            {!readOnly ? (
              <ActasElementQuickActions
                canAddSubelement={element.canHaveSubelements}
                historyOpen={historyOpen}
                onAddEntry={(e) => {
                  e.stopPropagation();
                  setAddOpen(true);
                  setSubOpen(false);
                }}
                onAddSubelement={(e) => {
                  e.stopPropagation();
                  setSubOpen(true);
                  setAddOpen(false);
                }}
                onToggleHistory={(e) => {
                  e.stopPropagation();
                  setHistoryOpen((v) => !v);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setArchiveOpen(true);
                }}
              />
            ) : (
              <span className="w-0 shrink-0" aria-hidden />
            )}
            {isSubElement ? (
              <span
                className="shrink-0 text-text-muted/60 text-[10px] select-none"
                aria-hidden
              >
                └
              </span>
            ) : null}
            <span
              className={`min-w-0 truncate text-text-body ${
                isSubElement ? "text-xs" : "text-sm font-medium"
              }`}
              title={element.name}
            >
              {element.name}
            </span>
          </div>

          <ActasOwnerPicker
            elementId={element.id}
            owners={owners}
            compact
            readOnly={readOnly}
            onOwnersChange={setOwners}
            onError={(msg) => onToast?.(msg)}
          />

          <ActasStatusPicker
            elementId={element.id}
            status={rowStatus}
            readOnly={readOnly}
            onStatusChange={handleStatusChange}
            onError={(msg) => onToast?.(msg)}
          />

          <ActasTimelinePicker
            elementId={element.id}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            status={rowStatus}
            readOnly={readOnly}
            onTimelineChange={(start, end) => {
              setTimelineStart(start);
              setTimelineEnd(end);
            }}
            onError={(msg) => onToast?.(msg)}
          />

          <span
            className="min-w-0 text-xs text-text-body truncate cursor-default"
            title={entryFull.length > 0 ? entryFull : undefined}
          >
            {readOnly && !effectivePreview ? (
              <span className="text-text-muted italic text-[11px]">
                Sin actividad previa
              </span>
            ) : entryPreviewText ? (
              entryPreviewText
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </span>

          <span className="text-[11px] text-text-muted whitespace-nowrap tabular-nums">
            {(readOnly ? element.lastEntryDate : lastDate) ? relativeDate : "—"}
          </span>
        </div>
      </div>

      {!readOnly && addOpen ? (
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

      {!readOnly && subOpen && element.canHaveSubelements ? (
        <ActasAddSubelementPanel
          parentElementId={element.id}
          indentPx={rowIndent + 8}
          onCancel={() => setSubOpen(false)}
          onCreated={() => {
            setSubOpen(false);
            router.refresh();
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
          readOnly={readOnly}
          asOfDate={asOfDate}
          onLastEntryChange={
            readOnly
              ? undefined
              : (latest) => {
                  setLastPreview(latest?.content ?? null);
                  setLastDate(latest?.entryDate ?? null);
                }
          }
        />
      ) : null}

      {archiveOpen ? (
        <ActasArchiveElementModal
          elementId={element.id}
          elementName={element.name}
          descendantCount={descendantCount}
          onClose={() => setArchiveOpen(false)}
          onArchived={({ elementName: archivedName }) => {
            onElementArchived?.(`${archivedName} eliminado.`);
            router.refresh();
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
          readOnly={readOnly}
          asOfDate={asOfDate}
          onElementArchived={onElementArchived}
          onToast={onToast}
        />
      ))}
    </>
  );
}
