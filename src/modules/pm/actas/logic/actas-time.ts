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
