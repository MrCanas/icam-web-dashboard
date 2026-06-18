import {
  OPERATIVO_GRID_BASE_CLASS,
  operativoGridTemplate,
} from "@/modules/pm/actas/logic/element-display";

export function ActasOperativoColumnHeader({
  showSelectionColumn = false,
}: {
  showSelectionColumn?: boolean;
}) {
  return (
    <div
      className={`${OPERATIVO_GRID_BASE_CLASS} border-b border-subtle/60 bg-page/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted`}
      style={{ gridTemplateColumns: operativoGridTemplate(showSelectionColumn) }}
    >
      {showSelectionColumn ? <span className="sr-only">Selección</span> : null}
      {/* Columna de controles (grip / acciones / chevron): sin etiqueta. */}
      <span aria-hidden />
      {/* Títulos desplazados una posición a la derecha respecto a su columna de
          datos: el nombre del elemento queda sin etiqueta y cada título se
          muestra sobre la columna siguiente (Elemento→Owner, Owner→Status, …).
          Se omite "Actualizado" por no haber columna libre al final. */}
      <span aria-hidden />
      <span>Elemento</span>
      <span>Owner</span>
      <span className="text-center">Status</span>
      <span>Avance</span>
      <span>Plazo</span>
      <span>Última entrada</span>
    </div>
  );
}
