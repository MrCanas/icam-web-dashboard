/** Paleta corporativa: frío → cálido (~17 tonos). */
const FALLBACK_SEQUENCE = [
  "#1E3A5F",
  "#2563EB",
  "#3B82C4",
  "#0E7490",
  "#0D9488",
  "#059669",
  "#16A34A",
  "#65A30D",
  "#B89660",
  "#CA9A5C",
  "#D4A574",
  "#EAB308",
  "#F59E0B",
  "#EA580C",
  "#DC2626",
  "#991B1B",
  "#7F1D1D",
] as const;

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .trim();
}

/** Prioridad keyword → índice en FALLBACK_SEQUENCE (tonos agrupados por fase). */
function keywordBucket(name: string): number | null {
  const u = normKey(name);
  if (/ARRAS|COMPRA|SUELO|ADQUISICION/.test(u)) return 0;
  if (/ANTEPROYECTO|BASIC|EJECUTIV|DISENO|PROYECTO\s*B/.test(u)) return 4;
  if (/SOLICITUD|LICENCIA|LICEN/.test(u)) return 8;
  if (/LICITACION|ADJUDICACION/.test(u)) return 10;
  if (/INICIO\s*OBRA|FIN\s*OBRA|OBRA/.test(u)) return 11;
  if (/TRAMITE|ENTREGA|SALIDA|VENTA|FINAL/.test(u)) return 14;
  return null;
}

export function getHitoColor(hitoName: string, fallbackIndex: number): string {
  const bucket = keywordBucket(hitoName);
  const idx =
    bucket !== null
      ? Math.min(bucket + (fallbackIndex % 3), FALLBACK_SEQUENCE.length - 1)
      : fallbackIndex % FALLBACK_SEQUENCE.length;
  return FALLBACK_SEQUENCE[idx] ?? FALLBACK_SEQUENCE[0];
}

export interface CanonicalHitoEntry {
  name: string;
  minOrden: number;
}

/** Orden estable para leyenda y colores: por menor orden_hito observado, luego nombre. */
export function collectCanonicalHitosFromPortfolio(
  rows: import("@/lib/pm-queries").PmPortfolioRow[],
): CanonicalHitoEntry[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    for (const h of row.hitos) {
      const prev = map.get(h.hito);
      const o = h.orden_hito;
      if (prev === undefined || o < prev) map.set(h.hito, o);
    }
  }
  return [...map.entries()]
    .map(([name, minOrden]) => ({ name, minOrden }))
    .sort((a, b) => a.minOrden - b.minOrden || a.name.localeCompare(b.name));
}

export function collectCanonicalHitosFromHitos(
  hitos: import("@/lib/pm-queries").PmHitoEnriched[],
): CanonicalHitoEntry[] {
  const sorted = [...hitos].sort((a, b) => a.orden_hito - b.orden_hito);
  return sorted.map((h) => ({ name: h.hito, minOrden: h.orden_hito }));
}

/** Índice estable del hito en la lista canónica (para color fallback). */
export function hitoColorIndex(canonical: CanonicalHitoEntry[], hitoName: string): number {
  const i = canonical.findIndex((c) => c.name === hitoName);
  return i >= 0 ? i : 0;
}
