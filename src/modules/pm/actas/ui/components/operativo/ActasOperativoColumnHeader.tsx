import { OPERATIVO_ROW_GRID } from "@/modules/pm/actas/logic/element-display";

export function ActasOperativoColumnHeader() {
  return (
    <div
      className={`${OPERATIVO_ROW_GRID} border-b border-subtle/60 bg-page/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted`}
    >
      <span>Elemento</span>
      <span>Owner</span>
      <span>Status</span>
      <span>Plazo</span>
      <span>Última entrada</span>
      <span>Actualizado</span>
    </div>
  );
}
