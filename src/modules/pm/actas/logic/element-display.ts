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
export const OPERATIVO_BOARD_MIN_WIDTH_PX = 920;

/** Clases grid compartidas entre cabecera y filas del tablero operativo. */
export const OPERATIVO_ROW_GRID =
  "grid grid-cols-[minmax(160px,1.25fr)_72px_96px_minmax(100px,0.75fr)_minmax(140px,1fr)_88px_80px] gap-x-3 items-center";
