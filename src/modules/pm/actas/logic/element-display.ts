const ENTRY_PREVIEW_MAX = 150;

export function truncateEntryPreview(content: string, maxLen = ENTRY_PREVIEW_MAX): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1).trimEnd()}…`;
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDateOnly(value: string): string {
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return dateFormatter.format(d);
}

/** Rango timeline del elemento (columnas Monday). */
export function formatTimelineRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  if (start && end) return `${formatDateOnly(start)} – ${formatDateOnly(end)}`;
  if (start) return formatDateOnly(start);
  return formatDateOnly(end!);
}

/** Ancho mínimo del tablero (scroll horizontal en pantallas estrechas). */
export const OPERATIVO_BOARD_MIN_WIDTH_PX = 960;

export const OPERATIVO_BOARD_MIN_WIDTH_WITH_SELECTION_PX =
  OPERATIVO_BOARD_MIN_WIDTH_PX + 28;

/**
 * Plantilla de columnas del tablero, definida UNA vez y compartida por la
 * cabecera y por cada fila vía `style={{ gridTemplateColumns }}` → imposible
 * que diverjan (y sin depender del JIT de Tailwind para valores arbitrarios).
 *
 * Orden visual: [controles: grip + acciones + chevron/contador]
 * [nombre ELEMENTO + iconos] [owner] [status] [avance] [plazo]
 * [última entrada] [actualizado]. La columna de controles es de ancho fijo para
 * que el NOMBRE (y el título "ELEMENTO") empiece en la misma posición en todas
 * las filas.
 */
export const OPERATIVO_GRID_BASE_CLASS = "grid gap-x-2 items-center";

export const OPERATIVO_GRID_TEMPLATE =
  "164px minmax(160px,1.3fr) 56px 88px 120px minmax(120px,0.9fr) minmax(120px,1fr) 72px";

export const OPERATIVO_GRID_TEMPLATE_WITH_SELECTION = `28px ${OPERATIVO_GRID_TEMPLATE}`;

export function operativoGridTemplate(showSelectionColumn: boolean): string {
  return showSelectionColumn
    ? OPERATIVO_GRID_TEMPLATE_WITH_SELECTION
    : OPERATIVO_GRID_TEMPLATE;
}
