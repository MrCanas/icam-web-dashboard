import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

const NON_EDITABLE_SOURCES = new Set(["snapshot", "monday_update"]);

/** Entrada gestionable por el autor en UI V1 (editar / borrar). */
export function canManageLogEntry(
  entry: ActasLogEntryItem,
  currentAuthUserId: string | null,
): boolean {
  if (!currentAuthUserId || !entry.authorId || entry.deletedAt) {
    return false;
  }
  if (entry.authorId !== currentAuthUserId) {
    return false;
  }
  const src = entry.source?.trim().toLowerCase() ?? "";
  if (NON_EDITABLE_SOURCES.has(src)) {
    return false;
  }
  return true;
}

/** @deprecated Alias de canManageLogEntry */
export const canEditLogEntry = canManageLogEntry;
