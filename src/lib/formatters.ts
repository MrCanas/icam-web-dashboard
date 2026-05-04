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
