const locale = "es-ES";

export function fmtMEuros(value: number): string {
  const millions = value / 1_000_000;
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(millions)} M€`;
}

export function fmtPct(value: number): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * 100)}%`;
}

export function fmtMult(value: number): string {
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}x`;
}

export function fmtInt(value: number): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Fechas — centralizadas para no reinventar Intl.DateTimeFormat en cada
// componente (había 12 copias con 3 formatos incompatibles). Ver auditoría §5.3.
// ---------------------------------------------------------------------------

const FECHA_CORTA = new Intl.DateTimeFormat(locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const FECHA_HORA = new Intl.DateTimeFormat(locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha «dd/mm/aaaa», o «—» si no hay valor o no es válido. */
export function fmtFechaCorta(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? FECHA_CORTA.format(d) : "—";
}

/** Fecha y hora «dd/mm/aaaa hh:mm», o «—» si no hay valor o no es válido. */
export function fmtFechaHora(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  return d ? FECHA_HORA.format(d) : "—";
}
