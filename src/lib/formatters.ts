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

// ---------------------------------------------------------------------------
// Euros con escala adaptativa — para las cifras corporativas.
//
// `fmtMEuros` fuerza millones con un decimal, que es lo correcto para el
// portfolio de proyectos (inversiones de 5-40 M€) pero aplasta la cuenta de
// resultados del grupo: un EBITDA trimestral de 7.768 € se lee como «0,0 M€».
// Estas dos eligen la escala según la magnitud. No sustituyen a `fmtMEuros`:
// las páginas de portfolio siguen usándola y no deben cambiar de aspecto.
// ---------------------------------------------------------------------------

function nf(min: number, max: number): Intl.NumberFormat {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
}

/**
 * Euros a la escala que toque: «12,5 M€», «393 k€», «7,8 k€», «456 €».
 *
 * Por debajo de 100 k€ se conserva un decimal, porque ahí la diferencia entre
 * 7,8 k€ y 8 k€ es la mitad de un EBITDA trimestral flojo.
 */
export function fmtEurosCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${nf(1, 1).format(value / 1_000_000)} M€`;
  if (abs >= 100_000) return `${nf(0, 0).format(value / 1_000)} k€`;
  if (abs >= 1_000) return `${nf(1, 1).format(value / 1_000)} k€`;
  return `${nf(0, 0).format(value)} €`;
}

/** Como `fmtEurosCompact`, pero marcando el signo: «+1,2 M€», «−340 k€». */
export function fmtEurosSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return fmtEurosCompact(0);
  const signo = value > 0 ? "+" : "−";
  return `${signo}${fmtEurosCompact(Math.abs(value))}`;
}

/** Porcentaje con signo explícito, para variaciones interanuales. */
export function fmtPctSigned(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value === 0) return fmtPct(0);
  const signo = value > 0 ? "+" : "−";
  return `${signo}${fmtPct(Math.abs(value))}`;
}

/** `fmtPct` tolerante a null, para las columnas del maestro que vienen vacías. */
export function fmtPctOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return fmtPct(value);
}

/** `fmtInt` tolerante a null. */
export function fmtIntOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return fmtInt(value);
}
