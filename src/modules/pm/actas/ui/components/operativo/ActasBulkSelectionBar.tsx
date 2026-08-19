"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { bulkAddElementOwner } from "@/modules/pm/actas/actions/bulk-add-element-owner";
import { bulkChangeElementStatus } from "@/modules/pm/actas/actions/bulk-change-element-status";
import { searchPmZoneUsers } from "@/modules/pm/actas/actions/element-owner";
import {
  ELEMENT_STATUS_LABEL,
  ELEMENT_STATUS_STYLE,
} from "@/modules/pm/actas/logic/element-status";
import { ELEMENT_STATUS_PICKER_ORDER } from "@/modules/pm/actas/logic/status-change-log";
import type { ElementStatus } from "@/modules/pm/actas/types";

import { useOperativoSelection } from "./ActasOperativoSelectionContext";

const STATUS_DROPDOWN_WIDTH = 180;
const OWNER_POPOVER_WIDTH = 300;
const SEARCH_DEBOUNCE_MS = 250;

interface ActasBulkSelectionBarProps {
  onError: (message: string) => void;
}

export function ActasBulkSelectionBar({ onError }: ActasBulkSelectionBarProps) {
  const router = useRouter();
  const selection = useOperativoSelection();
  const [pending, startTransition] = useTransition();

  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const ownerBtnRef = useRef<HTMLButtonElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const ownerPopoverRef = useRef<HTMLDivElement>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [statusPosition, setStatusPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [ownerPosition, setOwnerPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<
    {
      userId: string;
      email: string;
      label: string;
      initials: string;
      displayName: string;
    }[]
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const ownerInputId = useId();

  const count = selection?.selectedIds.size ?? 0;
  const elementIds = selection ? [...selection.selectedIds] : [];
  const selectionActive = selection?.selectionActive ?? false;

  const updateStatusPosition = useCallback(() => {
    const el = statusBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 4;
    if (left + STATUS_DROPDOWN_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - STATUS_DROPDOWN_WIDTH - 8;
    }
    setStatusPosition({ top, left });
  }, []);

  const updateOwnerPosition = useCallback(() => {
    const el = ownerBtnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 6;
    if (left + OWNER_POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - OWNER_POPOVER_WIDTH - 8;
    }
    setOwnerPosition({ top, left });
  }, []);

  const loadUsers = useCallback(
    async (q: string) => {
      setLoadingUsers(true);
      const res = await searchPmZoneUsers({ query: q, limit: 25 });
      setLoadingUsers(false);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      setUsers(res.users);
    },
    [onError],
  );

  useEffect(() => {
    if (!statusOpen) return;
    updateStatusPosition();
  }, [statusOpen, updateStatusPosition]);

  useEffect(() => {
    if (!ownerOpen) return;
    void loadUsers("");
    updateOwnerPosition();
  }, [ownerOpen, loadUsers, updateOwnerPosition]);

  useEffect(() => {
    if (!ownerOpen) return;
    const timer = window.setTimeout(() => {
      void loadUsers(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [ownerOpen, query, loadUsers]);

  const applyStatus = (newStatus: ElementStatus) => {
    if (!selection) return;
    setStatusOpen(false);
    selection.applyStatusLive(elementIds, newStatus);

    startTransition(async () => {
      const result = await bulkChangeElementStatus({
        elementIds,
        newStatus,
      });
      if (!result.ok) {
        onError(result.error);
        router.refresh();
        return;
      }
      if (result.failed > 0) {
        onError(
          `Estado actualizado en ${result.updated} elemento(s); ${result.failed} fallaron.`,
        );
      }
      selection.clearAll();
      router.refresh();
    });
  };

  const applyOwner = (userId: string) => {
    if (!selection) return;
    setOwnerOpen(false);

    startTransition(async () => {
      const result = await bulkAddElementOwner({ elementIds, userId });
      if (!result.ok) {
        onError(result.error);
        return;
      }
      selection.clearAll();
      router.refresh();
    });
  };

  if (!selectionActive || !selection) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 z-[65] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-icam-900/25 bg-card px-4 py-2.5 shadow-xl"
      role="toolbar"
      aria-label="Acciones en lote"
    >
      <span className="text-sm font-medium text-icam-900 tabular-nums">
        {count} seleccionado{count === 1 ? "" : "s"}
      </span>

      <span className="hidden h-5 w-px bg-subtle/60 sm:block" aria-hidden />

      <button
        ref={statusBtnRef}
        type="button"
        disabled={pending}
        className="rounded-md border border-subtle/60 bg-page px-3 py-1.5 text-sm text-text-primary hover:bg-icam-900/5 disabled:opacity-50"
        aria-expanded={statusOpen}
        onClick={() => {
          setOwnerOpen(false);
          setStatusOpen((v) => !v);
        }}
      >
        Cambiar status
      </button>

      <button
        ref={ownerBtnRef}
        type="button"
        disabled={pending}
        className="rounded-md border border-subtle/60 bg-page px-3 py-1.5 text-sm text-text-primary hover:bg-icam-900/5 disabled:opacity-50"
        aria-expanded={ownerOpen}
        onClick={() => {
          setStatusOpen(false);
          setOwnerOpen((v) => !v);
          setQuery("");
        }}
      >
        Cambiar owner
      </button>

      <button
        type="button"
        disabled={pending}
        className="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-icam-900 hover:bg-page disabled:opacity-50"
        onClick={() => selection.clearAll()}
      >
        Deseleccionar todo
      </button>

      {statusOpen && statusPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={statusDropdownRef}
              role="listbox"
              aria-label="Cambiar status en lote"
              className="fixed z-[70] w-[180px] overflow-hidden rounded-md border border-subtle/60 bg-card py-1 shadow-lg"
              style={{ top: statusPosition.top, left: statusPosition.left }}
            >
              {ELEMENT_STATUS_PICKER_ORDER.map((option) => {
                const style = ELEMENT_STATUS_STYLE[option];
                return (
                  <button
                    key={option}
                    type="button"
                    role="option"
                    disabled={pending}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-page/80 disabled:opacity-50"
                    onClick={() => applyStatus(option)}
                  >
                    <span
                      className="min-w-0 flex-1 truncate rounded px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: style.bg,
                        color: style.text,
                      }}
                    >
                      {ELEMENT_STATUS_LABEL[option]}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}

      {ownerOpen && ownerPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={ownerPopoverRef}
              role="dialog"
      aria-modal="true"
              aria-labelledby={`${ownerInputId}-title`}
              className="fixed z-[70] w-[300px] rounded-lg border border-subtle/60 bg-card shadow-xl"
              style={{ top: ownerPosition.top, left: ownerPosition.left }}
            >
              <div className="border-b border-subtle/40 px-3 py-2">
                <h3
                  id={`${ownerInputId}-title`}
                  className="text-xs font-semibold text-text-primary"
                >
                  Asignar responsable a todos
                </h3>
                <p className="mt-1 text-[10px] text-text-muted leading-snug">
                  Añade el usuario elegido como owner en cada elemento
                  seleccionado.
                </p>
              </div>
              <div className="p-3 space-y-2">
                <input
                  id={ownerInputId}
                  type="search"
                  autoFocus
                  value={query}
                  placeholder="Buscar por nombre o email…"
                  className="w-full rounded-md border border-subtle/60 bg-page px-2.5 py-1.5 text-xs"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {loadingUsers ? (
                  <p className="text-xs text-text-muted">Cargando…</p>
                ) : users.length === 0 ? (
                  <p className="text-xs text-text-muted">Sin coincidencias.</p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto -mx-1">
                    {users.map((member) => (
                      <li key={member.userId}>
                        <button
                          type="button"
                          disabled={pending}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-page disabled:opacity-50"
                          onClick={() => applyOwner(member.userId)}
                        >
                          <span className="font-medium">{member.displayName}</span>
                          <span className="truncate text-[10px] text-text-muted">
                            {member.email}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
