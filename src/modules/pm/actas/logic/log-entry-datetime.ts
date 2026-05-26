export function toDatetimeLocalValue(isoOrDate?: string | Date): string {
  const d =
    isoOrDate instanceof Date ? isoOrDate
    : isoOrDate ? new Date(isoOrDate)
    : new Date();
  if (Number.isNaN(d.getTime())) return toDatetimeLocalValue(new Date());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
