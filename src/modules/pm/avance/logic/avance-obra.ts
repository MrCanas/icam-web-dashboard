/**
 * Lógica pura de Avance de obra. Sin acceso a base de datos ni a React: todo lo
 * que hay aquí está cubierto por `npm run pm:test`.
 *
 * El invariante que gobierna el fichero entero es **NULL ≠ 0**: en el export de
 * Zoho conviven celdas vacías (Zoho no tiene valor) y ceros reportados. GA91
 * trae las 6 fases vacías, DC15 las trae a cero. Confundirlos haría que el día
 * que se comuniquen los cambios se sobrescriban campos vacíos de Zoho con ceros.
 */

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Parseo del export
// ---------------------------------------------------------------------------

/**
 * Normaliza una celda de porcentaje del export de Zoho.
 *
 * El fichero trae los tres tipos mezclados en la misma columna: `"100.0"`,
 * `75` y `null`. Y una hoja reexportada desde un Excel en español puede traer
 * coma decimal, así que se acepta.
 */
export function parsePorcentajeZoho(raw: unknown): Validated<number | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === "string" && raw.trim() === "") return { ok: true, value: null };

  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) {
    return { ok: false, error: `«${String(raw)}» no es un porcentaje` };
  }
  if (n < 0 || n > 100) {
    return { ok: false, error: `Porcentaje fuera de rango (0–100): ${n}` };
  }
  return { ok: true, value: redondea2(n) };
}

/**
 * Valida lo que escribe la PMO en el editor.
 *
 * `null` es un valor VÁLIDO y necesario: es la única forma de expresar «Zoho no
 * tiene valor» y de deshacer un dato metido por error sin dejar un 0 falso.
 */
export function validatePorcentaje(raw: unknown): Validated<number | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === "string" && raw.trim() === "") return { ok: true, value: null };

  const n = typeof raw === "number" ? raw : Number(String(raw).trim().replace(",", "."));
  if (!Number.isFinite(n)) {
    return { ok: false, error: "El porcentaje debe ser un número" };
  }
  if (n < 0) return { ok: false, error: "El porcentaje no puede ser negativo" };
  if (n > 100) return { ok: false, error: "El porcentaje no puede pasar de 100" };
  return { ok: true, value: redondea2(n) };
}

/** La columna de la base es numeric(5,2): más decimales no sobrevivirían. */
function redondea2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Comparación (espejo en TS del IS DISTINCT FROM de la migración 028)
// ---------------------------------------------------------------------------

/**
 * ¿Hay algo que comunicarle a Zoho para esta fase?
 *
 * Es el espejo exacto del `IS DISTINCT FROM` que usa pm_avance_registrar_cambio.
 * Si esto y el SQL divergen, la interfaz dice «pendiente» con la bandeja vacía
 * (o al revés) y nadie vuelve a fiarse de la bandeja.
 */
export function hayCambioVsZoho(actual: number | null, zoho: number | null): boolean {
  if (actual === null && zoho === null) return false;
  if (actual === null || zoho === null) return true;
  return actual !== zoho;
}

// ---------------------------------------------------------------------------
// Presentación
// ---------------------------------------------------------------------------

const NF = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

/**
 * Porcentaje para pintar.
 *
 * NO se reutiliza `fmtPct` de `@/lib/formatters`: aquélla espera una fracción
 * (0–1) y multiplica por 100. Aquí los valores ya vienen en 0–100 y pasarlos
 * por ella los multiplicaría por cien.
 */
export function fmtPorcentaje(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${NF.format(v)} %`;
}

/** Ancho de barra. `null` pinta barra vacía, nunca 0 % «de verdad». */
export function anchoBarra(v: number | null): string {
  if (v === null || v === undefined) return "0%";
  return `${Math.max(0, Math.min(100, v))}%`;
}

// ---------------------------------------------------------------------------
// El aviso de «esto no cuadra»
// ---------------------------------------------------------------------------

export interface DivergenciaGeneral {
  diverge: boolean;
  /** Media simple de las fases con dato, o null si no hay ninguna. */
  mediaFases: number | null;
}

/**
 * ¿El «Avance general» de Zoho se aleja de lo que dicen sus propias fases?
 *
 * No sirve para corregir nada: el general es un campo que Zoho calcula por su
 * cuenta y aquí se muestra tal cual. Solo decide si merece la pena avisar de la
 * discrepancia, que en los datos reales es enorme (SE84: 1,35 % general con
 * «Actuaciones previas» al 45,38 %; PS7: 0 % general con la estructura al 75 %).
 *
 * Umbral de 5 puntos: por debajo es ruido de redondeo y avisar sería ruido.
 */
export function generalDivergeDeFases(
  general: number | null,
  fases: readonly (number | null)[],
  umbral = 5,
): DivergenciaGeneral {
  const conDato = fases.filter((v): v is number => v !== null && v !== undefined);
  if (conDato.length === 0 || general === null || general === undefined) {
    return { diverge: false, mediaFases: null };
  }
  const media = redondea2(conDato.reduce((a, b) => a + b, 0) / conDato.length);
  return { diverge: Math.abs(media - general) > umbral, mediaFases: media };
}

// ---------------------------------------------------------------------------
// Exportación para Zoho
// ---------------------------------------------------------------------------

export interface CambioAprobado {
  zohoRecordId: string;
  zohoAnalyticsId: string | null;
  codigoPromocion: string;
  /** Cabecera literal de la columna en Zoho. */
  zohoColumna: string | null;
  /** Nombre API del campo en Zoho CRM. null mientras no se conozca. */
  zohoApiName: string | null;
  faseNombre: string;
  porcentajeNuevo: number | null;
}

export interface FilaCsvZoho {
  recordId: string;
  analyticsId: string;
  codigo: string;
  /** Clave = cabecera literal; solo las fases con cambio aprobado. */
  valores: Record<string, number | null>;
}

/**
 * Agrupa los cambios aprobados en una fila por promoción, lista para una
 * actualización masiva en Zoho.
 *
 * Una fase sin cambio aprobado NO aparece en `valores`: emitir su valor actual
 * sería reescribir en Zoho algo que nadie ha aprobado.
 */
export function construirFilasCsvZoho(cambios: readonly CambioAprobado[]): FilaCsvZoho[] {
  const porPromocion = new Map<string, FilaCsvZoho>();
  for (const c of cambios) {
    let fila = porPromocion.get(c.zohoRecordId);
    if (!fila) {
      fila = {
        recordId: c.zohoRecordId,
        analyticsId: c.zohoAnalyticsId ?? `zcrm_${c.zohoRecordId}`,
        codigo: c.codigoPromocion,
        valores: {},
      };
      porPromocion.set(c.zohoRecordId, fila);
    }
    fila.valores[c.zohoColumna ?? c.faseNombre] = c.porcentajeNuevo;
  }
  return [...porPromocion.values()];
}

/** Marca que hace imposible enviar por API un campo cuyo nombre no conocemos. */
export const API_NAME_PENDIENTE = "__API_NAME_PENDIENTE__";

export interface CuerpoBulkUpdateZoho {
  /** Un objeto por registro: `id` más una clave por campo a escribir. */
  data: Record<string, string | number | null>[];
  /** Vacío: esto corrige un dato, no dispara automatismos del CRM. */
  trigger: string[];
}

/**
 * Cuerpo de un `PUT /crm/v8/<Módulo>` de Zoho CRM.
 *
 * Es literalmente lo que envía `pushAvance`, para que el fichero descargado y
 * el botón hagan exactamente lo mismo: `{ data: [{ id, Campo: valor }] }`, con
 * los campos al nivel del registro (no anidados bajo `data`, que es el error
 * fácil de cometer leyendo la documentación por encima).
 *
 * Donde falta `zoho_api_name` se emite una clave marcada en vez de inventarse
 * un nombre: así el fichero no se puede subir «sin querer» creyendo que vale.
 */
export function construirJsonZoho(
  cambios: readonly CambioAprobado[],
): CuerpoBulkUpdateZoho {
  const porPromocion = new Map<string, Record<string, number | null>>();
  for (const c of cambios) {
    const campos = porPromocion.get(c.zohoRecordId) ?? {};
    const clave = c.zohoApiName ?? `${API_NAME_PENDIENTE}${c.faseNombre}`;
    campos[clave] = c.porcentajeNuevo;
    porPromocion.set(c.zohoRecordId, campos);
  }
  return {
    data: [...porPromocion.entries()].map(([id, campos]) => ({ id, ...campos })),
    trigger: [],
  };
}

/** Serializa a CSV con las cabeceras literales de Zoho. */
export function serializarCsvZoho(
  filas: readonly FilaCsvZoho[],
  columnasFase: readonly string[],
): string {
  const cabeceras = ["Record Id", "Id", "Código de Promoción", ...columnasFase];
  const celda = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [cabeceras.map(celda).join(";")];
  for (const f of filas) {
    lineas.push(
      [
        celda(f.analyticsId),
        celda(f.recordId),
        celda(f.codigo),
        ...columnasFase.map((c) => (c in f.valores ? celda(f.valores[c]) : "")),
      ].join(";"),
    );
  }
  // Separador «;» y BOM los pone quien escribe la respuesta: Excel en español
  // necesita ambos para no destrozar acentos ni meterlo todo en una columna.
  return lineas.join("\r\n");
}
