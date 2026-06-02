/** Suma meses calendario a una fecha (p. ej. recordatorio «en N meses»). */
export function addRemindMonths(from: Date, months: number): Date {
  const result = new Date(from.getTime());
  result.setMonth(result.getMonth() + months);
  return result;
}
