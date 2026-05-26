/**
 * Returns the number of whole days between `isoDate` and `now`.
 * Returns null if the input is null or unparseable.
 */
export function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const past = new Date(isoDate).getTime();
  if (Number.isNaN(past)) return null;
  const diffMs = Date.now() - past;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function formatLastActivity(days: number | null): string {
  if (days === null) return "Sin actividad";
  if (days === 0) return "Hoy";
  if (days === 1) return "Hace 1 día";
  return `Hace ${days} días`;
}

/** Fecha de log en formato dd/mm/yyyy. */
export function formatLogEntryDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Fecha relativa para última entrada de log ("hace 3 días"). */
export function formatRelativeEntryDate(isoDate: string | null): string {
  const days = daysSince(isoDate);
  if (days === null) return "—";
  return formatLastActivity(days);
}
