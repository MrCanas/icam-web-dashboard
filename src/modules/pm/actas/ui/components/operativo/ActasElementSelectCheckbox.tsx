"use client";

import { useOperativoSelection } from "./ActasOperativoSelectionContext";

interface ActasElementSelectCheckboxProps {
  elementId: string;
}

export function ActasElementSelectCheckbox({
  elementId,
}: ActasElementSelectCheckboxProps) {
  const selection = useOperativoSelection();
  if (!selection?.enabled) return null;

  const checked = selection.isSelected(elementId);
  const showAlways =
    selection.selectionActive || checked;

  return (
    <label
      className={`flex h-7 w-7 shrink-0 items-center justify-center transition-opacity ${
        showAlways
          ? "opacity-100"
          : "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
      }`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        className="h-3.5 w-3.5 rounded border-subtle/80 text-icam-900 focus:ring-icam-900/30"
        aria-label={checked ? "Quitar de la selección" : "Seleccionar elemento"}
        onChange={() => selection.toggle(elementId)}
      />
    </label>
  );
}
