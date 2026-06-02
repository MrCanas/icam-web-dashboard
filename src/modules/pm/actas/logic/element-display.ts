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
export const OPERATIVO_BOARD_MIN_WIDTH_PX = 780;

/**
 * Grid compacto: elemento (+ acciones hover), owner, status, plazo, última entrada, actualizado.
 */
export const OPERATIVO_ROW_GRID =
  "grid grid-cols-[minmax(200px,1.4fr)_56px_88px_minmax(120px,0.9fr)_minmax(120px,1fr)_72px] gap-x-2 items-center";

/** Tablero operativo con columna de selección múltiple. */
export const OPERATIVO_ROW_GRID_WITH_SELECTION =
  "grid grid-cols-[28px_minmax(200px,1.4fr)_56px_88px_minmax(120px,0.9fr)_minmax(120px,1fr)_72px] gap-x-2 items-center";
