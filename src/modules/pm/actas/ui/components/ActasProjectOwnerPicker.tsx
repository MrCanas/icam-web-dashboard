"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { searchPmZoneUsers } from "@/modules/pm/actas/actions/element-owner";
import { setProjectOwner } from "@/modules/pm/actas/actions/set-project-owner";
import {
  avatarColorFromEmail,
  avatarColorFromUserId,
} from "@/modules/pm/actas/logic/actas-avatar";
import type { ActasProjectOwner } from "@/modules/pm/actas/types";

const POPOVER_WIDTH = 300;
const SEARCH_DEBOUNCE_MS = 250;

interface ActasProjectOwnerPickerProps {
  projectId: string;
  owner: ActasProjectOwner | null;
  /** true si el usuario puede modificar el responsable (editor de la zona pm). */
  canEdit: boolean;
}

type UserOption = {
  userId: string;
  email: string;
  label: string;
  initials: string;
  displayName: string;
};

function OwnerAvatar({
  owner,
  size = "md",
}: {
  owner: { userId: string; email: string | null; initials: string };
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-6 w-6 text-[9px]" : "h-7 w-7 text-[10px]";
  const bg = owner.email
    ? avatarColorFromEmail(owner.email)
    : avatarColorFromUserId(owner.userId);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${dim}`}
      style={{ backgroundColor: bg }}
      aria-hidden
    >
      {owner.initials || "?"}
    </span>
  );
}

export function ActasProjectOwnerPicker({
  projectId,
  owner: initialOwner,
  canEdit,
}: ActasProjectOwnerPickerProps) {
  const router = useRouter();
  const inputId = useId();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Estado local del owner (optimista). No se deriva de props vía useEffect:
  // se inicializa una vez y se actualiza en cada cambio confirmado/optimista.
  const [owner, setOwner] = useState<ActasProjectOwner | null>(initialOwner);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

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

  const loadUsers = useCallback(async (q: string) => {
    setLoadingUsers(true);
    const res = await searchPmZoneUsers({ query: q, limit: 25 });
    setLoadingUsers(false);
    if (!res.ok) {
      showToast(res.error);
      return;
    }
    setUsers(res.users);
  }, [showToast]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  // Carga inicial (query="") al abrir y recarga al teclear, siempre vía timer
  // (no setState síncrono en el cuerpo del efecto).
  useEffect(() => {
    if (!open) return;
    const delay = query ? SEARCH_DEBOUNCE_MS : 0;
    const timer = window.setTimeout(() => void loadUsers(query), delay);
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

  const persist = async (next: ActasProjectOwner | null) => {
    if (pending) return;
    setOpen(false);
    const previous = owner;
    setOwner(next); // optimista
    setPending(true);
    const result = await setProjectOwner({
      projectId,
      ownerUserId: next?.userId ?? null,
    });
    setPending(false);
    if (!result.ok) {
      setOwner(previous); // rollback
      showToast(result.error || "No se pudo cambiar el responsable");
      return;
    }
    setOwner(result.owner); // versión resuelta en servidor
    router.refresh();
  };

  const selectUser = (u: UserOption) => {
    if (u.userId === owner?.userId) {
      setOpen(false);
      return;
    }
    void persist({
      userId: u.userId,
      email: u.email,
      displayName: u.displayName || u.label,
      initials: u.initials,
    });
  };

  const ownerLabel = owner?.displayName || owner?.email || null;

  // Solo lectura: muestra el responsable sin interacción.
  if (!canEdit) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
          Responsable
        </span>
        {owner ? (
          <span className="flex items-center gap-1.5">
            <OwnerAvatar owner={owner} size="sm" />
            <span className="text-sm text-text-body">{ownerLabel}</span>
          </span>
        ) : (
          <span className="text-sm text-text-muted">Sin responsable</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
        Responsable
      </span>
      <button
        ref={anchorRef}
        type="button"
        disabled={pending}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Cambiar responsable del proyecto"
        className="inline-flex items-center gap-1.5 rounded-md border border-subtle/60 bg-page px-2 py-1 text-sm text-text-body transition-colors hover:bg-card disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/30"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
      >
        {owner ? (
          <>
            <OwnerAvatar owner={owner} size="sm" />
            <span className="max-w-[180px] truncate">{ownerLabel}</span>
          </>
        ) : (
          <span className="text-text-muted">Sin responsable</span>
        )}
        <span className="text-[10px] text-text-muted" aria-hidden>
          ▾
        </span>
      </button>

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-labelledby={`${inputId}-title`}
              className="fixed z-[70] w-[300px] rounded-lg border border-subtle/60 bg-card shadow-xl"
              style={{ top: position.top, left: position.left }}
            >
              <div className="border-b border-subtle/40 px-3 py-2">
                <h3
                  id={`${inputId}-title`}
                  className="text-xs font-semibold text-text-primary"
                >
                  Responsable del proyecto
                </h3>
              </div>

              <div className="space-y-2 p-3">
                <label htmlFor={inputId} className="sr-only">
                  Buscar usuario
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

                <button
                  type="button"
                  disabled={!owner}
                  onClick={() => void persist(null)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-text-muted hover:bg-page disabled:opacity-40"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-subtle text-[10px]">
                    —
                  </span>
                  Sin responsable
                </button>

                {loadingUsers ? (
                  <p className="py-2 text-xs text-text-muted">Cargando…</p>
                ) : users.length === 0 ? (
                  <p className="py-2 text-xs text-text-muted leading-snug">
                    Sin coincidencias.
                  </p>
                ) : (
                  <ul className="-mx-1 max-h-60 overflow-y-auto">
                    {users.map((u) => {
                      const selected = u.userId === owner?.userId;
                      return (
                        <li key={u.userId}>
                          <button
                            type="button"
                            disabled={pending}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-page disabled:opacity-50 ${
                              selected ? "bg-icam-900/5" : ""
                            }`}
                            onClick={() => selectUser(u)}
                          >
                            <OwnerAvatar
                              owner={{
                                userId: u.userId,
                                email: u.email,
                                initials: u.initials,
                              }}
                              size="sm"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-text-body">
                                {u.displayName || u.label}
                              </span>
                              <span className="block truncate text-[10px] text-text-muted">
                                {u.email}
                              </span>
                            </span>
                            {selected ? (
                              <span
                                className="shrink-0 text-sm text-emerald-600"
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

      {toast
        ? createPortal(
            <div
              className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-md border border-icam-900/20 bg-card px-4 py-2.5 text-sm font-medium text-icam-900 shadow-lg"
              role="status"
            >
              {toast}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
