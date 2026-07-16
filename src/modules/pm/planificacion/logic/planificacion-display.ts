import type { PmHitoEnriched } from "@/modules/pm/data/pmRepository";
import type { PmSnapshot } from "@/modules/pm/types";

export const LEVANTAMIENTO = "levantamiento";

/** Trimestres en los que ESTE proyecto tiene alguna fecha. El resto no existen para él. */
export function snapshotsConDatos(hitos: PmHitoEnriched[]): Set<string> {
  const con = new Set<string>();
  for (const h of hitos) {
    for (const [code, fecha] of Object.entries(h.snapshots)) {
      if (fecha) con.add(code);
    }
  }
  return con;
}

/**
 * Columnas de snapshot visibles al abrir un proyecto.
 *
 * Levantamiento (el plan original, siempre útil) + el último trimestre añadido
 * SI ese proyecto tiene datos en él. Si no los tiene, solo Levantamiento.
 *
 * Los proyectos ni empiezan a la vez ni se reportan todos cada trimestre: CA1 no
 * tiene ninguna fecha en 2025 y DC-15 no tiene ninguna en Q4 2025 ni Q1 2026.
 * Mostrar las cinco columnas a todos llenaba la rejilla de rayas.
 *
 * El resto de trimestres con datos quedan disponibles en el menú de columnas.
 */
export function columnasPorDefecto(
  snapshots: PmSnapshot[],
  hitos: PmHitoEnriched[],
): string[] {
  const conDatos = snapshotsConDatos(hitos);
  const cols: string[] = [];

  if (conDatos.has(LEVANTAMIENTO)) cols.push(LEVANTAMIENTO);

  const ultimo = ultimoTrimestre(snapshots);
  if (ultimo && conDatos.has(ultimo)) cols.push(ultimo);

  return cols;
}

/** Último trimestre añadido al registro; null si solo hay levantamiento. */
export function ultimoTrimestre(snapshots: PmSnapshot[]): string | null {
  const trimestres = snapshots
    .filter((s) => s.snapshot_code !== LEVANTAMIENTO)
    .sort((a, b) => b.orden - a.orden);
  return trimestres[0]?.snapshot_code ?? null;
}

/**
 * Columnas de snapshot ofrecidas en el menú: solo las que tienen datos para este
 * proyecto, en orden cronológico. Ofrecer una columna vacía sería ofrecer nada.
 */
export function columnasDisponibles(
  snapshots: PmSnapshot[],
  hitos: PmHitoEnriched[],
): PmSnapshot[] {
  const conDatos = snapshotsConDatos(hitos);
  return snapshots.filter((s) => conDatos.has(s.snapshot_code));
}

/**
 * Plantilla de columnas de la rejilla, definida UNA vez y aplicada por la
 * cabecera y por cada fila vía `style={{ gridTemplateColumns }}` → imposible que
 * diverjan, y sin depender del JIT de Tailwind para valores arbitrarios.
 * Mismo criterio que element-display.ts en el tablero de Actas.
 *
 * Orden visual: [selección] [hito] [mapeo Tabla madre] [orden] [fecha actual]
 * [un snapshot por trimestre visible…]
 */
export const GRID_BASE_CLASS = "grid gap-x-2 items-center";

/** Columnas fijas. `hito` no se puede ocultar: sin ella la fila no se identifica. */
export const COLUMNAS_FIJAS = [
  { key: "hito", label: "Hito", ancho: 240, min: 140, ocultable: false },
  { key: "tabla_madre", label: "Tabla madre", ancho: 132, min: 90, ocultable: true },
  { key: "orden", label: "Ord.", ancho: 52, min: 40, ocultable: true },
  { key: "prevision", label: "Previsión", ancho: 124, min: 90, ocultable: false },
] as const;

export type ColumnaFijaKey = (typeof COLUMNAS_FIJAS)[number]["key"];

export const ANCHO_SNAPSHOT_DEFECTO = 104;
export const ANCHO_SNAPSHOT_MIN = 72;
const ANCHO_SELECCION = 28;

/** Ancho por columna, en px. La clave es `key` de fija o el `snapshot_code`. */
export type Anchos = Record<string, number>;

export function anchoDe(key: string, anchos: Anchos): number {
  const fija = COLUMNAS_FIJAS.find((c) => c.key === key);
  return anchos[key] ?? fija?.ancho ?? ANCHO_SNAPSHOT_DEFECTO;
}

export function anchoMinimoDe(key: string): number {
  const fija = COLUMNAS_FIJAS.find((c) => c.key === key);
  return fija?.min ?? ANCHO_SNAPSHOT_MIN;
}

/**
 * Plantilla de columnas, definida UNA vez y aplicada por la cabecera y por cada
 * fila vía `style={{ gridTemplateColumns }}` → imposible que diverjan al
 * redimensionar, y sin depender del JIT de Tailwind para valores arbitrarios.
 */
export function planificacionGridTemplate(
  fijasVisibles: readonly string[],
  snapshotsVisibles: readonly string[],
  anchos: Anchos = {},
): string {
  const cols = [
    `${ANCHO_SELECCION}px`,
    ...fijasVisibles.map((k) => `${anchoDe(k, anchos)}px`),
    ...snapshotsVisibles.map((c) => `${anchoDe(c, anchos)}px`),
  ];
  return cols.join(" ");
}

/** Ancho mínimo del tablero: por debajo, scroll horizontal propio. */
export function boardMinWidthPx(
  fijasVisibles: readonly string[],
  snapshotsVisibles: readonly string[],
  anchos: Anchos = {},
): number {
  const suma = [...fijasVisibles, ...snapshotsVisibles].reduce(
    (acc, k) => acc + anchoDe(k, anchos),
    ANCHO_SELECCION,
  );
  return suma + 48;
}

/** Etiqueta del snapshot: respeta el override de pm_snapshots.label si lo hay. */
export function snapshotLabel(snap: PmSnapshot): string {
  if (snap.label?.trim()) return snap.label.trim();
  if (snap.snapshot_code === "levantamiento") return "Levantamiento";
  const m = /^(\d{4})_Q([1-4])$/.exec(snap.snapshot_code);
  if (m) return `Q${m[2]} ${m[1]}`;
  return snap.snapshot_code;
}

const FMT = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

/** Fecha corta para celda. Null y centinelas de Excel se muestran como raya. */
export function formatFechaCorta(iso: string | null): string | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  if (s.startsWith("1899-")) return null;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return FMT.format(d);
}

/**
 * Trimestre natural de hoy, como sugerencia al añadirlo. La PMO puede cambiarlo:
 * a veces se reporta un trimestre ya cerrado.
 */
export function trimestreActual(hoy = new Date()): string {
  return `${hoy.getFullYear()}_Q${Math.floor(hoy.getMonth() / 3) + 1}`;
}
