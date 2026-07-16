import type { PmSnapshot } from "@/modules/pm/types";

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

const COLS_FIJAS = "28px minmax(180px,1.4fr) 132px 52px 124px";
const ANCHO_SNAPSHOT = "104px";

export function planificacionGridTemplate(snapshotsVisibles: number): string {
  const snaps = Array.from({ length: snapshotsVisibles }, () => ANCHO_SNAPSHOT).join(" ");
  return snaps ? `${COLS_FIJAS} ${snaps}` : COLS_FIJAS;
}

/** Ancho mínimo del tablero: por debajo, scroll horizontal propio. */
export function boardMinWidthPx(snapshotsVisibles: number): number {
  return 28 + 180 + 132 + 52 + 124 + snapshotsVisibles * 104 + 48;
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
 * Trimestre natural de hoy, como sugerencia al congelar. La PMO puede cambiarlo:
 * a veces se reporta un trimestre ya cerrado.
 */
export function trimestreActual(hoy = new Date()): string {
  return `${hoy.getFullYear()}_Q${Math.floor(hoy.getMonth() / 3) + 1}`;
}
