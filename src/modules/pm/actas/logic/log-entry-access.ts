import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

const NON_EDITABLE_SOURCES = new Set(["snapshot", "monday_update"]);

export const LOG_ENTRY_MANAGE_DENIED_TOOLTIP =
  "Solo el autor puede modificar";

function isNonEditableSource(source: string | null | undefined): boolean {
  const src = source?.trim().toLowerCase() ?? "";
  return NON_EDITABLE_SOURCES.has(src);
}

/** Entrada gestionable por el autor o un admin pm (editar / borrar). */
export function canManageLogEntry(
  entry: Pick<
    ActasLogEntryItem,
    "authorId" | "deletedAt" | "source"
  >,
  currentAuthUserId: string | null,
  isPmAdmin = false,
): boolean {
  if (!currentAuthUserId || entry.deletedAt) {
    return false;
  }
  if (isNonEditableSource(entry.source)) {
    return false;
  }
  if (isPmAdmin) {
    return true;
  }
  if (!entry.authorId || entry.authorId !== currentAuthUserId) {
    return false;
  }
  return true;
}

/** Muestra iconos de gestión (habilitados o deshabilitados) a editores con escritura. */
export function canShowLogEntryManageActions(
  entry: Pick<ActasLogEntryItem, "deletedAt" | "source">,
  hasWriteAccess: boolean,
): boolean {
  if (!hasWriteAccess || entry.deletedAt) {
    return false;
  }
  if (isNonEditableSource(entry.source)) {
    return false;
  }
  return true;
}

export function isLogEntryManageDisabled(
  entry: Pick<
    ActasLogEntryItem,
    "authorId" | "deletedAt" | "source"
  >,
  currentAuthUserId: string | null,
  isPmAdmin: boolean,
  hasWriteAccess: boolean,
): boolean {
  return (
    canShowLogEntryManageActions(entry, hasWriteAccess) &&
    !canManageLogEntry(entry, currentAuthUserId, isPmAdmin)
  );
}

/** @deprecated Alias de canManageLogEntry */
export const canEditLogEntry = canManageLogEntry;
