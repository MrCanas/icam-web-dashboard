import { OPERATIVO_ROW_GRID } from "@/modules/pm/actas/logic/element-display";

export function ActasOperativoColumnHeader() {
  return (
    <div
      className={`${OPERATIVO_ROW_GRID} border-b border-subtle/60 bg-page/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted`}
    >
      <span>Elemento</span>
      <span>Owner</span>
      <span>Status</span>
      <span>Timeline</span>
      <span>Última entrada</span>
      <span>Fecha</span>
      <span className="text-right"> </span>
    </div>
  );
}
