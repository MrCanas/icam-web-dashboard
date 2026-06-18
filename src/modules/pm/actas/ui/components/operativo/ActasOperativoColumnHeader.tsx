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
      <span>Elemento</span>
      {/* Cada título se alinea igual que su contenido dentro de la columna:
          OWNER/STATUS/PLAZO/ACTUALIZADO a la izquierda (avatar, píldora con
          justify-self-start, plazo text-left y fecha relativa pegan a la izq.);
          AVANCE centrado porque la barra de progreso ocupa toda la columna. */}
      <span>Owner</span>
      <span>Status</span>
      <span className="text-center">Avance</span>
      <span>Plazo</span>
      <span>Última entrada</span>
      <span>Actualizado</span>
    </div>
  );
}
