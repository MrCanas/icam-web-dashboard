"use client";

import {
  canManageLogEntry,
  isLogEntryManageDisabled,
  LOG_ENTRY_MANAGE_DENIED_TOOLTIP,
} from "@/modules/pm/actas/logic/log-entry-access";
import type { ActasLogEntryItem } from "@/modules/pm/actas/types";

interface ActasLogEntryManageButtonsProps {
  entry: ActasLogEntryItem;
  currentAuthUserId: string | null;
  isPmAdmin: boolean;
  hasWriteAccess: boolean;
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}

function IconPencil() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

export function ActasLogEntryManageButtons({
  entry,
  currentAuthUserId,
  isPmAdmin,
  hasWriteAccess,
  readOnly = false,
  onEdit,
  onDelete,
  className = "",
}: ActasLogEntryManageButtonsProps) {
  if (readOnly || entry.deletedAt) return null;

  const manageable = canManageLogEntry(entry, currentAuthUserId, isPmAdmin);
  const disabled = isLogEntryManageDisabled(
    entry,
    currentAuthUserId,
    isPmAdmin,
    hasWriteAccess,
  );

  if (!manageable && !disabled) return null;

  const btnClass =
    "inline-flex h-7 w-7 items-center justify-center rounded hover:bg-icam-900/10 disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title={
          disabled ? LOG_ENTRY_MANAGE_DENIED_TOOLTIP : "Editar entrada"
        }
        aria-label="Editar entrada"
        disabled={disabled}
        className={`${btnClass} text-icam-900`}
        onClick={onEdit}
      >
        <IconPencil />
      </button>
      <button
        type="button"
        title={
          disabled ? LOG_ENTRY_MANAGE_DENIED_TOOLTIP : "Eliminar entrada"
        }
        aria-label="Eliminar entrada"
        disabled={disabled}
        className={`${btnClass} text-red-700/80`}
        onClick={onDelete}
      >
        <IconTrash />
      </button>
    </span>
  );
}
