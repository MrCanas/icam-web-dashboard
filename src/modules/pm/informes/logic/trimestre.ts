/**
 * Trimestres en los dos formatos del portal: el de los informes («Q3 2026»)
 * y el de los snapshots de planificación («2026_Q3»).
 */

export interface Trimestre {
  anio: number;
  q: 1 | 2 | 3 | 4;
}

export function parseTrimestre(texto: string): Trimestre | null {
  const m = /^Q([1-4]) (\d{4})$/.exec((texto ?? "").trim());
  if (!m) return null;
  return { anio: Number(m[2]), q: Number(m[1]) as Trimestre["q"] };
}

export function textoTrimestre(t: Trimestre): string {
  return `Q${t.q} ${t.anio}`;
}

export function trimestreAnterior(t: Trimestre): Trimestre {
  return t.q === 1 ? { anio: t.anio - 1, q: 4 } : { anio: t.anio, q: (t.q - 1) as Trimestre["q"] };
}

export function trimestreSiguiente(t: Trimestre): Trimestre {
  return t.q === 4 ? { anio: t.anio + 1, q: 1 } : { anio: t.anio, q: (t.q + 1) as Trimestre["q"] };
}

/** «Q3 2026» → «Q2 2026». Devuelve el texto tal cual si no es un trimestre. */
export function qAnt(q: string): string {
  const t = parseTrimestre(q);
  return t ? textoTrimestre(trimestreAnterior(t)) : q;
}

/** «Q3 2026» → «Q4 2026». */
export function qSig(q: string): string {
  const t = parseTrimestre(q);
  return t ? textoTrimestre(trimestreSiguiente(t)) : q;
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

/** Último día del trimestre «Qn AAAA» (YYYY-MM-DD). */
export function qCierre(q: string): string {
  const t = parseTrimestre(q);
  return t ? rangoTrimestre(t).hasta : "";
}

/** Trimestre al que pertenece una fecha. */
export function trimestreDeFecha(d: Date): Trimestre {
  return { anio: d.getFullYear(), q: (Math.floor(d.getMonth() / 3) + 1) as Trimestre["q"] };
}

/**
 * Trimestre que se informa por defecto: el que acaba de cerrar o, en el último
 * mes de un trimestre, el que está cerrando (los informes se preparan en las
 * últimas semanas del trimestre y las primeras del siguiente).
 */
export function trimestrePorDefecto(hoy: Date = new Date()): string {
  const actual = trimestreDeFecha(hoy);
  const ultimoMes = hoy.getMonth() % 3 === 2;
  return textoTrimestre(ultimoMes ? actual : trimestreAnterior(actual));
}

/** Trimestres que se ofrecen en los selectores: de dos por delante a nueve por detrás. */
export function listaTrimestres(hoy: Date = new Date()): string[] {
  let t = trimestreSiguiente(trimestreSiguiente(trimestreDeFecha(hoy)));
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    out.push(textoTrimestre(t));
    t = trimestreAnterior(t);
  }
  return out;
}

/** id del informe: SE84_Q3-2026. */
export function idInforme(codigo: string, trimestre: string): string {
  return `${codigo}_${trimestre.replace(" ", "-")}`;
}

/** Saneado del código corto de un proyecto (mismo que la app original). */
export function limpiarCodigo(c: string): string {
  return String(c || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_\-.]/g, "")
    .slice(0, 40);
}

/** id de informe válido (para rutas y parámetros). */
export function esIdInforme(id: string): boolean {
  return /^[A-Za-z0-9_\-.]{1,40}_Q[1-4]-\d{4}$/.test(id);
}
