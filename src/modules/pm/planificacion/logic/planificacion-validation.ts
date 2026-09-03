/**
 * Validación de entradas de Planificación. A mano y devolviendo mensajes en
 * español, siguiendo la convención del repo (no se usa zod en ningún sitio).
 */
import { parseQuarterCode } from "@/modules/pm/logic/pm-viz";

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

/** UUID v4 tal y como los genera gen_random_uuid(). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUuid(raw: string, campo = "id"): Validated<string> {
  const v = String(raw ?? "").trim();
  if (!v) return { ok: false, error: `Falta ${campo}` };
  if (!UUID_RE.test(v)) return { ok: false, error: `${campo} no es un identificador válido` };
  return { ok: true, value: v };
}

/**
 * Fecha ISO YYYY-MM-DD, o null para vaciar el hito.
 *
 * Rechaza fechas imposibles comprobando el round-trip: `new Date("2027-02-31")`
 * no falla, desplaza a marzo. El maestro financiero tiene un 31-02-2027 real en
 * Fecha LPO, así que esto no es teórico.
 */
export function validateFechaIso(raw: unknown): Validated<string | null> {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { ok: true, value: null };
  }
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { ok: false, error: "La fecha debe tener formato AAAA-MM-DD" };
  }
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    return { ok: false, error: `Fecha inexistente: ${s}` };
  }
  const year = Number(s.slice(0, 4));
  if (year < 2000 || year > 2100) {
    return { ok: false, error: "El año debe estar entre 2000 y 2100" };
  }
  return { ok: true, value: s };
}

/** Código de snapshot del trimestre reportado: YYYY_Qn. */
export function validateSnapshotCode(raw: string): Validated<string> {
  const v = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (!v) return { ok: false, error: "Falta el código de snapshot" };
  if (v === "FECHA_ACTUAL") {
    return { ok: false, error: "«fecha_actual» es la previsión viva, no un snapshot" };
  }
  const q = parseQuarterCode(v);
  if (!q) {
    return { ok: false, error: `Formato inválido: usa AAAA_Qn (p. ej. 2026_Q2), no «${raw}»` };
  }
  return { ok: true, value: `${q.y}_Q${q.q}` };
}

/** Código de activo: se guarda tal cual pero sin espacios sobrantes. */
export function validateIdActivo(raw: string): Validated<string> {
  const v = String(raw ?? "").trim();
  if (!v) return { ok: false, error: "El código de proyecto es obligatorio" };
  if (v.length > 60) return { ok: false, error: "El código no puede pasar de 60 caracteres" };
  return { ok: true, value: v };
}

export const TIPOS_USO = ["APT", "RESIDENCIAL_LIBRE", "TERCIARIO", "FONDO"] as const;
export type TipoUso = (typeof TIPOS_USO)[number];

/**
 * El CHECK de pm_activos solo admite estos cuatro valores (migración 037: la 020
 * los dejó en APT y RESIDENCIAL_LIBRE). Si hace falta otro uso, hay que ampliarlo
 * con una migración: aquí solo se valida contra lo que la base de datos aceptará,
 * para dar un error legible en vez de un fallo de constraint.
 */
export function validateTipoUso(raw: string): Validated<TipoUso> {
  const v = String(raw ?? "").trim().toUpperCase();
  if (!(TIPOS_USO as readonly string[]).includes(v)) {
    return { ok: false, error: `Tipo de uso no válido. Admitidos: ${TIPOS_USO.join(", ")}` };
  }
  return { ok: true, value: v as TipoUso };
}

export function validateOrdenHito(raw: unknown): Validated<number> {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 999) {
    return { ok: false, error: "El orden debe ser un entero entre 0 y 999" };
  }
  return { ok: true, value: n };
}

/** Meses a desplazar en bloque. Acota para evitar sacar el Gantt de su dominio. */
export function validateMeses(raw: unknown): Validated<number> {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n === 0) {
    return { ok: false, error: "Indica un número entero de meses distinto de 0" };
  }
  if (Math.abs(n) > 120) {
    return { ok: false, error: "El desplazamiento no puede pasar de 120 meses" };
  }
  return { ok: true, value: n };
}

/** Suma meses respetando fin de mes (31 ene + 1 mes = 28/29 feb, no 3 mar). */
export function shiftIsoMonths(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + meses, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
