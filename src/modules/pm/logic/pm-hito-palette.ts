/** Paleta fija PM por orden_hito (17º reutiliza 1º). */
const FALLBACK_SEQUENCE = [
  "#508F7A", // 1 ARRAS
  "#9B7F57", // 2 COMPRA EDIFICIO
  "#475F7D", // 3 Anteproyecto
  "#98416B", // 4 Proyecto basico
  "#573569", // 5 Proyecto Ejecutivo
  "#B59350", // 6 Solicitud de licencia
  "#396657", // 7 Obtencion licencia
  "#811E2D", // 8 Lanzamiento Licitacion
  "#AD4426", // 9 Inicio de obra
  "#3D7A8A", // 10 Fin de obra
  "#7A5C3E", // 11 Tramites final de Obra
  "#5B7A4E", // 12 Inspeccion Turismo
  "#6B4E7A", // 13 Entrega llaves Operador
  "#7A3E4E", // 14 Incio/Inicio pago renta
  "#3E6B7A", // 15 Salida del Vehiculo
  "#8A7A3D", // 16 Inicio comercializacion
] as const;

function normKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .trim();
}

/** Mapa de hitos nominales -> índice (0-based) de la paleta fija. */
function explicitHitoIndex(name: string): number | null {
  const u = normKey(name);
  if (u === "ARRAS") return 0;
  if (u === "COMPRA EDIFICIO") return 1;
  if (u === "ANTEPROYECTO") return 2;
  if (u === "PROYECTO BASICO") return 3;
  if (u === "PROYECTO EJECUTIVO") return 4;
  if (u === "SOLICITUD DE LICENCIA") return 5;
  if (u === "OBTENCION LICENCIA") return 6;
  if (u === "LANZAMIENTO LICITACION") return 7;
  if (u === "INICIO DE OBRA") return 8;
  if (u === "FIN DE OBRA") return 9;
  if (u === "TRAMITES FINAL DE OBRA") return 10;
  if (u === "INSPECCION TURISMO") return 11;
  if (u === "ENTREGA LLAVES OPERADOR") return 12;
  if (u === "INCIO PAGO RENTA" || u === "INICIO PAGO RENTA") return 13;
  if (u === "SALIDA DEL VEHICULO") return 14;
  if (u === "INICIO COMERCIALIZACION") return 15;
  if (u === "FIN COMERCIALIZACION") return 0;
  return null;
}

export function getHitoColor(hitoName: string, fallbackIndex: number): string {
  const explicit = explicitHitoIndex(hitoName);
  const idx = explicit !== null ? explicit : fallbackIndex % FALLBACK_SEQUENCE.length;
  return FALLBACK_SEQUENCE[idx] ?? FALLBACK_SEQUENCE[0];
}

export interface CanonicalHitoEntry {
  name: string;
  minOrden: number;
}

/** Orden estable para leyenda y colores: por menor orden_hito observado, luego nombre. */
export function collectCanonicalHitosFromPortfolio(
  rows: import("@/modules/pm/data/pmRepository").PmPortfolioRow[],
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
  hitos: import("@/modules/pm/data/pmRepository").PmHitoEnriched[],
): CanonicalHitoEntry[] {
  const sorted = [...hitos].sort((a, b) => a.orden_hito - b.orden_hito);
  return sorted.map((h) => ({ name: h.hito, minOrden: h.orden_hito }));
}

/** Índice estable del hito en la lista canónica (para color fallback). */
export function hitoColorIndex(canonical: CanonicalHitoEntry[], hitoName: string): number {
  const i = canonical.findIndex((c) => c.name === hitoName);
  return i >= 0 ? i : 0;
}
