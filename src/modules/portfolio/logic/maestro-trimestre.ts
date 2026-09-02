/**
 * Normalización de la dimensión trimestral del maestro financiero. Lógica pura,
 * testeable con node:test.
 *
 * El maestro escribe el trimestre como «2025 4T» (columna H de la Tabla madre) y
 * PM lo escribe como «2025_Q4» (pm_snapshots.snapshot_code). Aquí se traduce al
 * vocabulario de PM, que es el que cruza las dos partes.
 */

/**
 * «2025 4T» | «4T 2025» | «2025_Q4» | «2025 Q4» → «2025_Q4».
 * «ALL TIME» (línea consolidada de proyectos culminados) y cualquier cosa no
 * reconocida → null: no son un trimestre reportado.
 */
export function normalizeTrimestreCode(raw: unknown): string | null {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!s || s === "ALL TIME") return null;

  // «2025 4T» / «2025 Q4» / «2025_Q4» / «2025-4T»
  let m = /^(\d{4})[ _-](?:([1-4])T|Q([1-4]))$/.exec(s);
  if (m) return `${m[1]}_Q${m[2] ?? m[3]}`;

  // «4T 2025» / «Q4 2025»
  m = /^(?:([1-4])T|Q([1-4]))[ _-](\d{4})$/.exec(s);
  if (m) return `${m[3]}_Q${m[1] ?? m[2]}`;

  return null;
}

/**
 * Centinela de Excel: una celda de fecha vacía formateada sale como el serial 0
 * (30/12/1899). Cualquier 1899-* se trata como «sin fecha».
 */
export function limpiarFechaMaestro(iso: string | null): string | null {
  if (!iso) return null;
  return iso.startsWith("1899-") ? null : iso;
}

/** Último día de cada trimestre, en formato MM-DD. */
const FIN_DE_TRIMESTRE: Record<string, string> = {
  Q1: "03-31",
  Q2: "06-30",
  Q3: "09-30",
  Q4: "12-31",
};

/**
 * «2025 4T» | «2025_Q4» → «2025-12-31». La columna EndQuarter del maestro es
 * la fecha de fin del proyecto expresada como trimestre; se materializa en su
 * último día para poder guardarla en una columna `date` y ordenar por ella.
 *
 * Devuelve null para «ALL TIME» y para cualquier cosa que no sea un trimestre
 * reconocible; el llamante decide entonces si es una fecha suelta.
 */
export function finDeTrimestreIso(raw: unknown): string | null {
  const code = normalizeTrimestreCode(raw);
  if (!code) return null;

  const [year, quarter] = code.split("_");
  const mmdd = FIN_DE_TRIMESTRE[quarter];
  if (!mmdd) return null;

  return `${year}-${mmdd}`;
}
