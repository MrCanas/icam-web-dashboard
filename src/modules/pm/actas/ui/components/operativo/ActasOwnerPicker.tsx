"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  addElementOwner,
  removeElementOwner,
  searchPmZoneUsers,
} from "@/modules/pm/actas/actions/element-owner";
import {
  avatarColorFromEmail,
  avatarColorFromUserId,
} from "@/modules/pm/actas/logic/actas-avatar";
import { isUnresolvedOwner } from "@/modules/pm/actas/logic/owner-display";
import type { ActasElementOwner } from "@/modules/pm/actas/types";

import { ActasOwnerAvatars } from "./ActasOwnerAvatars";

const POPOVER_WIDTH = 300;
const SEARCH_DEBOUNCE_MS = 250;

interface ActasOwnerPickerProps {
  elementId: string;
  owners: ActasElementOwner[];
  compact?: boolean;
  readOnly?: boolean;
  hasWriteAccess?: boolean;
  onOwnersChange: (owners: ActasElementOwner[]) => void;
  onError: (message: string) => void;
}

function OwnerMiniAvatar({
  owner,
  size = "sm",
  unresolved = false,
}: {
  owner: Pick<ActasElementOwner, "userId" | "email" | "initials">;
  size?: "sm" | "md";
  unresolved?: boolean;
}) {
  const dim = size === "sm" ? "h-5 w-5 text-[8px]" : "h-6 w-6 text-[9px]";
  const bg = unresolved
    ? "#9ca3af"
    : owner.email
      ? avatarColorFromEmail(owner.email)
      : avatarColorFromUserId(owner.userId);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dim}`}
      style={{ backgroundColor: bg }}
    >
      {unresolved ? "?" : owner.initials}
    </span>
  );
}

export function ActasOwnerPicker({
  elementId,
  owners,
  compact = false,
  readOnly = false,
  hasWriteAccess = true,
  onOwnersChange,
  onError,
}: ActasOwnerPickerProps) {
  const canAssign = hasWriteAccess && !readOnly;
  const inputId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
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
  const [pendingUserIds, setPendingUserIds] = useState<Set<string>>(
    () => new Set(),
  );

  const ownerIdSet = new Set(owners.map((o) => o.userId));

  const updatePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    const top = rect.bottom + 6;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPOVER_WIDTH - 8;
    }
    setPosition({ top, left });
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
    if (!open) return;
    void loadUsers("");
    updatePosition();
  }, [open, loadUsers, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void loadUsers(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [open, query, loadUsers]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const toggleOwner = async (member: {
    userId: string;
    email: string;
    label: string;
    initials: string;
  }) => {
    if (!canAssign || pendingUserIds.has(member.userId)) return;

    const isOwner = ownerIdSet.has(member.userId);
    const previous = owners;
    const nextOwner: ActasElementOwner = {
      userId: member.userId,
      email: member.email,
      label: member.label,
      initials: member.initials,
    };

    setPendingUserIds((s) => new Set(s).add(member.userId));
    if (isOwner) {
      onOwnersChange(owners.filter((o) => o.userId !== member.userId));
    } else {
      onOwnersChange([...owners, nextOwner]);
    }

    const result = isOwner
      ? await removeElementOwner({ elementId, userId: member.userId })
      : await addElementOwner({ elementId, userId: member.userId });

    setPendingUserIds((s) => {
      const n = new Set(s);
      n.delete(member.userId);
      return n;
    });

    if (!result.ok) {
      onOwnersChange(previous);
      onError(result.error);
    }
  };

  const removeCurrentOwner = async (owner: ActasElementOwner) => {
    if (!canAssign || pendingUserIds.has(owner.userId)) return;
    const previous = owners;
    setPendingUserIds((s) => new Set(s).add(owner.userId));
    onOwnersChange(owners.filter((o) => o.userId !== owner.userId));

    const result = await removeElementOwner({
      elementId,
      userId: owner.userId,
    });

    setPendingUserIds((s) => {
      const n = new Set(s);
      n.delete(owner.userId);
      return n;
    });

    if (!result.ok) {
      onOwnersChange(previous);
      onError(result.error);
    }
  };

  if (readOnly) {
    return (
      <ActasOwnerAvatars
        owners={owners}
        compact={compact}
        showAssignPlaceholder={false}
      />
    );
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="inline-flex items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/30"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Asignar responsable(s)"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setQuery("");
        }}
      >
        <ActasOwnerAvatars owners={owners} compact={compact} />
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-labelledby={`${inputId}-title`}
              className="fixed z-[70] w-[300px] rounded-lg border border-subtle/60 bg-card shadow-xl"
              style={{ top: position.top, left: position.left }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="border-b border-subtle/40 px-3 py-2">
                <h3
                  id={`${inputId}-title`}
                  className="text-xs font-semibold text-text-primary"
                >
                  Responsable
                </h3>
                {!canAssign ? (
                  <p className="mt-1 text-[10px] text-text-muted leading-snug">
                    Solo lectura: puedes consultar la lista pero no asignar.
                  </p>
                ) : null}
              </div>

              {owners.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 border-b border-subtle/30 px-3 py-2">
                  {owners.map((owner) => {
                    const unresolved = isUnresolvedOwner(owner);
                    const displayEmail = unresolved
                      ? "Usuario no encontrado"
                      : (owner.email ?? owner.label);
                    return (
                      <span
                        key={owner.userId}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-subtle/50 bg-page px-1.5 py-0.5 text-[10px] text-text-body"
                      >
                        <OwnerMiniAvatar
                          owner={owner}
                          unresolved={unresolved}
                        />
                        <span className="truncate max-w-[140px]">
                          {displayEmail}
                        </span>
                        {canAssign ? (
                          <button
                            type="button"
                            className="ml-0.5 text-text-muted hover:text-red-600"
                            aria-label={`Quitar ${displayEmail}`}
                            disabled={pendingUserIds.has(owner.userId)}
                            onClick={() => void removeCurrentOwner(owner)}
                          >
                            ×
                          </button>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              ) : null}

              <div className="p-3 space-y-2">
                <label htmlFor={inputId} className="sr-only">
                  Buscar usuario PM
                </label>
                <input
                  id={inputId}
                  type="search"
                  autoFocus
                  value={query}
                  placeholder="Buscar por nombre o email…"
                  className="w-full rounded-md border border-subtle/60 bg-page px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-icam-900/40 focus:outline-none focus:ring-1 focus:ring-icam-900/20"
                  onChange={(e) => setQuery(e.target.value)}
                />

                {loadingUsers ? (
                  <p className="py-2 text-xs text-text-muted">Cargando…</p>
                ) : users.length === 0 ? (
                  <p className="py-2 text-xs text-text-muted leading-snug">
                    Sin coincidencias entre usuarios con acceso a PM.
                  </p>
                ) : (
                  <ul className="max-h-52 overflow-y-auto -mx-1">
                    {users.map((member) => {
                      const selected = ownerIdSet.has(member.userId);
                      return (
                        <li key={member.userId}>
                          <button
                            type="button"
                            disabled={
                              !canAssign || pendingUserIds.has(member.userId)
                            }
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-page disabled:cursor-not-allowed disabled:opacity-50 ${
                              selected ? "bg-icam-900/5" : ""
                            }`}
                            onClick={() => void toggleOwner(member)}
                          >
                            <OwnerMiniAvatar owner={member} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-text-body">
                                {member.displayName}
                              </span>
                              <span className="block truncate text-[10px] text-text-muted">
                                {member.email}
                              </span>
                            </span>
                            {selected ? (
                              <span
                                className="shrink-0 text-emerald-600 text-sm"
                                aria-hidden
                              >
                                ✓
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
