import {
  OPERATIVO_ROW_GRID,
  OPERATIVO_ROW_GRID_WITH_SELECTION,
} from "@/modules/pm/actas/logic/element-display";

export function ActasOperativoColumnHeader({
  showSelectionColumn = false,
}: {
  showSelectionColumn?: boolean;
}) {
  const grid = showSelectionColumn
    ? OPERATIVO_ROW_GRID_WITH_SELECTION
    : OPERATIVO_ROW_GRID;

  return (
    <div
      className={`${grid} border-b border-subtle/60 bg-page/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted`}
    >
      {showSelectionColumn ? <span className="sr-only">Selección</span> : null}
      <span>Elemento</span>
      <span>Owner</span>
      <span>Status</span>
      <span>Plazo</span>
      <span>Última entrada</span>
      <span>Actualizado</span>
    </div>
  );
}
