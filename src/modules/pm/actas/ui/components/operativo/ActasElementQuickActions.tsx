"use client";

const iconClass =
  "h-4 w-4 shrink-0 text-text-muted group-hover/btn:text-icam-900 transition-colors";

function IconPlus() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconSubelement() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v8M8 9h8" />
      <path d="M5 19h6a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  );
}

interface QuickActionButtonProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

function QuickActionButton({
  label,
  onClick,
  children,
}: QuickActionButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="group/btn flex h-7 w-7 items-center justify-center rounded hover:bg-icam-900/10"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export interface ActasElementQuickActionsProps {
  canAddSubelement: boolean;
  onAddEntry: (e: React.MouseEvent) => void;
  onAddSubelement: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export function ActasElementQuickActions({
  canAddSubelement,
  onAddEntry,
  onAddSubelement,
  onDelete,
}: ActasElementQuickActionsProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <QuickActionButton label="Añadir entrada de log" onClick={onAddEntry}>
        <IconPlus />
      </QuickActionButton>
      {canAddSubelement ? (
        <QuickActionButton label="Añadir sub-elemento" onClick={onAddSubelement}>
          <IconSubelement />
        </QuickActionButton>
      ) : null}
      <QuickActionButton label="Eliminar elemento" onClick={onDelete}>
        <IconTrash />
      </QuickActionButton>
    </div>
  );
}
