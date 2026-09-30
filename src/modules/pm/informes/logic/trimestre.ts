/**
 * Trimestres en los dos formatos del portal: el de la app de informes
 * («Q3 2026») y el de los snapshots de planificación («2026_Q3»).
 */

export interface Trimestre {
  anio: number;
  q: 1 | 2 | 3 | 4;
}

export function parseTrimestre(texto: string): Trimestre | null {
  const m = /^Q([1-4]) (\d{4})$/.exec(texto.trim());
  if (!m) return null;
  return { anio: Number(m[2]), q: Number(m[1]) as Trimestre["q"] };
}

export function trimestreAnterior(t: Trimestre): Trimestre {
  return t.q === 1 ? { anio: t.anio - 1, q: 4 } : { anio: t.anio, q: (t.q - 1) as Trimestre["q"] };
}

export function textoTrimestre(t: Trimestre): string {
  return `Q${t.q} ${t.anio}`;
}

/** Código de snapshot de planificación (pm_snapshot_fechas.snapshot_code). */
export function codigoSnapshot(t: Trimestre): string {
  return `${t.anio}_Q${t.q}`;
}

function ymd(anio: number, mes0: number, dia: number): string {
  return new Date(Date.UTC(anio, mes0, dia)).toISOString().slice(0, 10);
}

/** Primer y último día del trimestre, en YYYY-MM-DD. */
export function rangoTrimestre(t: Trimestre): { desde: string; hasta: string } {
  const mesInicio = (t.q - 1) * 3;
  return {
    desde: ymd(t.anio, mesInicio, 1),
    // Día 0 del mes siguiente al último del trimestre = último día del trimestre.
    hasta: ymd(t.anio, mesInicio + 3, 0),
  };
}
