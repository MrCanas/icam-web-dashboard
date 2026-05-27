/** Fecha `asOf` en query: YYYY-MM-DD (día civil UTC). */

export function parseAsOfDateParam(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Fin del día UTC para comparar con timestamptz en BD. */
export function asOfDateToTimestamptz(isoDate: string): string {
  return `${isoDate}T23:59:59.999Z`;
}

/** true si la fecha es posterior al día de hoy (UTC). */
export function isAsOfFuture(isoDate: string): boolean {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  return isoDate > todayIso;
}

export function isAsOfBeforeProject(
  isoDate: string,
  projectCreatedAt: string,
): boolean {
  const projectDay = projectCreatedAt.slice(0, 10);
  return isoDate < projectDay;
}

export function formatAsOfDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}
