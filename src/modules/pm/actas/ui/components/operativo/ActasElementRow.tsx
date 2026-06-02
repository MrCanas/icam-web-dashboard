"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { countElementDescendants } from "@/modules/pm/actas/logic/count-element-descendants";
import {
  OPERATIVO_ROW_GRID,
  OPERATIVO_ROW_GRID_WITH_SELECTION,
} from "@/modules/pm/actas/logic/element-display";
import { formatRelativeEntryDate } from "@/modules/pm/actas/logic/actas-time";
import type { ActasLogEntryItem, ActasOperativoElement, ElementStatus } from "@/modules/pm/actas/types";

import { ActasElementSelectCheckbox } from "./ActasElementSelectCheckbox";
import { useOperativoSelection } from "./ActasOperativoSelectionContext";
import { ActasAddLogEntryPanel } from "./ActasAddLogEntryPanel";
import { ActasAddSubelementPanel } from "./ActasAddSubelementPanel";
import { ActasArchiveElementModal } from "./ActasArchiveElementModal";
import { ActasElementInlineHistory } from "./ActasElementInlineHistory";
import { ActasElementQuickActions } from "./ActasElementQuickActions";
import { ActasElementNameCell } from "./ActasElementNameCell";
import { ActasLastEntryCell } from "./ActasLastEntryCell";
import { ActasOwnerPicker } from "./ActasOwnerPicker";
import { ActasStatusPicker } from "./ActasStatusPicker";
import { ActasElementNotificationBell } from "./ActasElementNotificationBell";
import { ActasTimelinePicker } from "./ActasTimelinePicker";

interface ActasElementRowProps {
  element: ActasOperativoElement;
  projectCode: string;
  currentAuthUserId: string | null;
  isPmAdmin?: boolean;
  hasWriteAccess?: boolean;
  depth?: number;
  /** Asa de arrastre (DnD operativo); si está presente, los hijos se renderizan fuera. */
  dragHandle?: React.ReactNode | null;
  readOnly?: boolean;
  asOfDate?: string;
  showAsCompleted?: boolean;
  onElementStatusLiveChange?: (
    elementId: string,
    status: ElementStatus,
  ) => void;
  onElementArchived?: (message: string) => void;
  onToast?: (message: string) => void;
}

const INDENT_PX = 20;

export function ActasElementRow({
  element,
  projectCode,
  currentAuthUserId,
  isPmAdmin = false,
  hasWriteAccess = true,
  depth = 0,
  dragHandle = null,
  readOnly = false,
  asOfDate,
  showAsCompleted = false,
  onElementStatusLiveChange,
  onElementArchived,
  onToast,
}: ActasElementRowProps) {
  const router = useRouter();
  const selection = useOperativoSelection();
  const rowGrid =
    selection?.enabled && hasWriteAccess && !readOnly
      ? OPERATIVO_ROW_GRID_WITH_SELECTION
      : OPERATIVO_ROW_GRID;
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
  const [lastEntryId, setLastEntryId] = useState<string | null>(
    element.lastEntryId,
  );
  const [lastEntryAuthorId, setLastEntryAuthorId] = useState<string | null>(
    element.lastEntryAuthorId,
  );
  const [lastEntrySource, setLastEntrySource] = useState<string | null>(
    element.lastEntrySource,
  );
  const [displayName, setDisplayName] = useState(element.name);
  const [owners, setOwners] = useState(element.owners);
  const [timelineStart, setTimelineStart] = useState<string | null>(
    element.timelineStart,
  );
  const [timelineEnd, setTimelineEnd] = useState<string | null>(
    element.timelineEnd,
  );

  useEffect(() => {
    setDisplayName(element.name);
  }, [element.name]);
  useEffect(() => {
    if (!selection?.liveStatusById[element.id]) {
      setDisplayStatus(element.status);
    }
  }, [element.status, element.id, selection?.liveStatusById]);
  useEffect(() => {
    setOwners(element.owners);
  }, [element.owners]);
  useEffect(() => {
    setTimelineStart(element.timelineStart);
    setTimelineEnd(element.timelineEnd);
  }, [element.timelineStart, element.timelineEnd]);
  useEffect(() => {
    setLastPreview(element.lastEntryContent);
    setLastDate(element.lastEntryDate);
    setLastEntryId(element.lastEntryId);
    setLastEntryAuthorId(element.lastEntryAuthorId);
    setLastEntrySource(element.lastEntrySource);
  }, [
    element.lastEntryContent,
    element.lastEntryDate,
    element.lastEntryId,
    element.lastEntryAuthorId,
    element.lastEntrySource,
  ]);

  const bulkStatus = selection?.liveStatusById[element.id];
  const rowStatus = readOnly
    ? element.status
    : (bulkStatus ?? displayStatus);
  const relativeDate = formatRelativeEntryDate(
    readOnly ? element.lastEntryDate : lastDate,
  );
  const rowIndent = depth * INDENT_PX;
  const isSubElement = depth > 0;
  const directChildCount = element.children.length;
  const hasDirectChildren = !isSubElement && directChildCount > 0;
  const [childrenExpanded, setChildrenExpanded] = useState(true);
  const descendantCount = countElementDescendants(element);
  const expanded = historyOpen || addOpen || subOpen;
  const renderChildrenInline = dragHandle == null;

  const handleStatusChange = (
    newStatus: ElementStatus,
    entry: ActasLogEntryItem | null,
  ) => {
    setDisplayStatus(newStatus);
    onElementStatusLiveChange?.(element.id, newStatus);
    if (entry) {
      setLastPreview(entry.content);
      setLastDate(entry.entryDate);
      setLastEntryId(entry.id);
      setLastEntryAuthorId(entry.authorId);
      setLastEntrySource(entry.source);
      setHistoryReloadNonce((n) => n + 1);
    }
  };

  const handleRowToggle = () => {
    if (addOpen || subOpen) return;
    setHistoryOpen((v) => !v);
  };

  const syncLastFromHistory = (latest: ActasLogEntryItem | null) => {
    setLastPreview(latest?.content ?? null);
    setLastDate(latest?.entryDate ?? null);
    setLastEntryId(latest?.id ?? null);
    setLastEntryAuthorId(latest?.authorId ?? null);
    setLastEntrySource(latest?.source ?? null);
  };

  return (
    <>
      <div className="border-b border-subtle/40">
        <div
          role="button"
          tabIndex={0}
          onClick={handleRowToggle}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRowToggle();
            }
          }}
          className={`group/row ${rowGrid} px-3 py-1.5 min-h-9 transition-colors cursor-pointer ${
            isSubElement
              ? "bg-page/30 hover:bg-page/50"
              : "bg-card hover:bg-page/60"
          } ${showAsCompleted ? "opacity-60" : ""} ${expanded ? "bg-page/40" : ""} ${historyOpen ? "bg-page/50" : ""}`}
          aria-expanded={historyOpen}
        >
          <div
            className={`flex min-w-0 items-center gap-1 ${
              isSubElement ? "border-l-2 border-icam-900/20 pl-1.5" : ""
            }`}
            style={{ paddingLeft: rowIndent }}
          >
            <ActasElementSelectCheckbox elementId={element.id} />
            {dragHandle}
            {!readOnly ? (
              <ActasElementQuickActions
                canAddSubelement={element.canHaveSubelements}
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
                onDelete={(e) => {
                  e.stopPropagation();
                  setArchiveOpen(true);
                }}
              />
            ) : (
              <span className="w-0 shrink-0" aria-hidden />
            )}
            {hasDirectChildren ? (
              <button
                type="button"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-text-muted hover:bg-icam-900/10 hover:text-icam-900"
                aria-expanded={childrenExpanded}
                aria-label={
                  childrenExpanded
                    ? "Colapsar sub-elementos"
                    : "Expandir sub-elementos"
                }
                title={
                  childrenExpanded
                    ? "Colapsar sub-elementos"
                    : "Expandir sub-elementos"
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setChildrenExpanded((v) => !v);
                }}
              >
                {childrenExpanded ? "▾" : "▸"}
              </button>
            ) : isSubElement ? (
              <span
                className="shrink-0 text-text-muted/60 text-[10px] select-none w-5 text-center"
                aria-hidden
              >
                └
              </span>
            ) : (
              <span className="w-5 shrink-0" aria-hidden />
            )}
            {hasDirectChildren ? (
              <span
                className="shrink-0 rounded bg-icam-900/10 px-1 py-px text-[9px] font-semibold tabular-nums text-icam-900/80"
                title={`${directChildCount} sub-elemento${directChildCount === 1 ? "" : "s"}`}
              >
                {directChildCount}
              </span>
            ) : null}
            {showAsCompleted ? (
              <span className="shrink-0 rounded bg-emerald-600/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-800">
                Completado
              </span>
            ) : null}
            <ActasElementNameCell
              elementId={element.id}
              name={readOnly ? element.name : displayName}
              isSubElement={isSubElement}
              hasWriteAccess={hasWriteAccess && !readOnly}
              readOnly={readOnly}
              onNameChange={setDisplayName}
              onError={(msg) => onToast?.(msg)}
            />
            <ActasElementNotificationBell
              elementId={element.id}
              readOnly={readOnly}
              onError={(msg) => onToast?.(msg)}
            />
          </div>

          <ActasOwnerPicker
            elementId={element.id}
            owners={owners}
            compact
            readOnly={readOnly}
            hasWriteAccess={hasWriteAccess && !readOnly}
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

          <ActasLastEntryCell
            entryId={readOnly ? element.lastEntryId : lastEntryId}
            content={readOnly ? element.lastEntryContent : lastPreview}
            entryDate={readOnly ? element.lastEntryDate : lastDate}
            authorId={readOnly ? element.lastEntryAuthorId : lastEntryAuthorId}
            source={readOnly ? element.lastEntrySource : lastEntrySource}
            currentAuthUserId={currentAuthUserId}
            isPmAdmin={isPmAdmin}
            hasWriteAccess={hasWriteAccess && !readOnly}
            readOnly={readOnly}
            onUpdated={(content, entryDate) => {
              setLastPreview(content);
              setLastDate(entryDate);
              setHistoryReloadNonce((n) => n + 1);
            }}
          />

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
            setLastEntryId(entry.id);
            setLastEntryAuthorId(entry.authorId);
            setLastEntrySource(entry.source);
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
        <ActasElementInlineHistory
          elementId={element.id}
          indentPx={rowIndent + (isSubElement ? 8 : 0)}
          currentAuthUserId={currentAuthUserId}
          isPmAdmin={isPmAdmin}
          hasWriteAccess={hasWriteAccess && !readOnly}
          reloadNonce={historyReloadNonce}
          readOnly={readOnly}
          asOfDate={asOfDate}
          onLastEntryChange={
            readOnly ? undefined : syncLastFromHistory
          }
        />
      ) : null}

      {archiveOpen ? (
        <ActasArchiveElementModal
          elementId={element.id}
          elementName={readOnly ? element.name : displayName}
          descendantCount={descendantCount}
          onClose={() => setArchiveOpen(false)}
          onArchived={({ elementName: archivedName }) => {
            onElementArchived?.(`${archivedName} eliminado.`);
            router.refresh();
          }}
        />
      ) : null}

      {renderChildrenInline &&
        (!hasDirectChildren || childrenExpanded) &&
        element.children.map((child) => (
          <ActasElementRow
            key={child.id}
            element={child}
            projectCode={projectCode}
            currentAuthUserId={currentAuthUserId}
            isPmAdmin={isPmAdmin}
            hasWriteAccess={hasWriteAccess}
            depth={depth + 1}
            readOnly={readOnly}
            asOfDate={asOfDate}
            showAsCompleted={showAsCompleted && child.status === "done"}
            onElementStatusLiveChange={onElementStatusLiveChange}
            onElementArchived={onElementArchived}
            onToast={onToast}
          />
        ))}
    </>
  );
}
