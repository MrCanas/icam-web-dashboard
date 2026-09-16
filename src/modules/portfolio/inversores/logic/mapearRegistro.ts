import type { TipoColumna, TipoFlujo } from "@/modules/portfolio/inversores/types";

/**
 * Registro crudo de Zoho → fila de la tabla espejo.
 *
 * Todo lo de aquí es puro y sin dependencias: es lo que se puede probar sin
 * credenciales, y es donde se concentran las rarezas de la API v8.
 */

export interface CampoResuelto {
  destino: string;
  zohoApiName: string;
  tipo: TipoColumna;
  notas: Record<string, unknown> | null;
}

export type RegistroZoho = Record<string, unknown> & { id: string };

/** Lo que Zoho devuelve en un campo de tipo lookup: nunca un escalar. */
function esLookup(v: unknown): v is { id?: unknown; name?: unknown } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function leerLookupId(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (!esLookup(v)) return null;
  return typeof v.id === "string" && v.id.trim() ? v.id.trim() : null;
}

export function leerLookupNombre(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (!esLookup(v)) return null;
  return typeof v.name === "string" && v.name.trim() ? v.name.trim() : null;
}

/**
 * Número tolerante.
 *
 * Devuelve `null` y no `0` cuando no hay valor: la diferencia entre «no lo
 * sabemos» y «es cero» es justo la que hace que un KPI mienta. Acepta también
 * el formato español («1.234,56») por si algún campo llega como texto desde una
 * fórmula del CRM.
 */
export function leerNumero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;

  const limpio = v.trim().replace(/[€\s]/g, "");
  if (!limpio) return null;

  // «1.234,56» → «1234.56»; «1234.56» se queda como está.
  const normalizado =
    limpio.includes(",") && limpio.lastIndexOf(",") > limpio.lastIndexOf(".")
      ? limpio.replace(/\./g, "").replace(",", ".")
      : limpio.replace(/,/g, "");

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** `date` de Zoho ya viene como `YYYY-MM-DD`; `datetime` trae hora y zona. */
export function leerFecha(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const soloFecha = v.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(soloFecha) ? soloFecha : null;
}

export function leerFechaHora(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function leerTexto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // Un multiselect llega como array de strings.
  if (Array.isArray(v)) {
    const partes = v.map((x) => leerTexto(x)).filter((x): x is string => !!x);
    return partes.length > 0 ? partes.join(", ") : null;
  }
  // Un lookup usado como texto: lo legible es el nombre.
  return leerLookupNombre(v);
}

function leerBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    if (["true", "sí", "si", "1"].includes(t)) return true;
    if (["false", "no", "0"].includes(t)) return false;
  }
  return null;
}

export function leerValor(v: unknown, tipo: TipoColumna): unknown {
  switch (tipo) {
    case "number":
      return leerNumero(v);
    case "date":
      return leerFecha(v);
    case "datetime":
      return leerFechaHora(v);
    case "bool":
      return leerBool(v);
    case "lookup_id":
      return leerLookupId(v);
    case "lookup_nombre":
      return leerLookupNombre(v);
    case "email":
      return leerTexto(v)?.toLowerCase() ?? null;
    case "text":
    case "picklist":
    default:
      return leerTexto(v);
  }
}

/** Sin acentos y en minúsculas, para comparar literales de desplegable. */
function plano(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Literal del desplegable de Zoho → vocabulario nuestro.
 *
 * Primero el diccionario de `inv_campo_catalogo.notas.normaliza`, que es lo que
 * una persona confirmó; si no casa, una heurística por raíz; y si tampoco,
 * `desconocido`.
 *
 * `desconocido` existe para NO perder la fila. Un valor nuevo en el CRM no
 * puede tumbar la carga ni desaparecer en silencio: la fila entra, se ve en la
 * tabla, se cuenta en el log y no suma en los KPIs.
 */
export function normalizarTipoFlujo(
  literal: string | null,
  notas: Record<string, unknown> | null,
): TipoFlujo {
  if (!literal) return "desconocido";

  const dic = notas?.normaliza;
  if (dic && typeof dic === "object" && !Array.isArray(dic)) {
    for (const [clave, valor] of Object.entries(dic as Record<string, unknown>)) {
      if (plano(clave) === plano(literal) && (valor === "aporte" || valor === "reparto")) {
        return valor;
      }
    }
  }

  const p = plano(literal);
  if (/aport|suscrip|desembols|capital call/.test(p)) return "aporte";
  if (/repart|distribu|devoluc|dividend/.test(p)) return "reparto";
  return "desconocido";
}

/**
 * Aplica el mapeo resuelto a un registro.
 *
 * `raw` se guarda siempre: es el seguro contra un mapeo incompleto. Si mañana
 * hace falta un campo que hoy no está mapeado, sale de ahí con un UPDATE en vez
 * de una lectura entera de Zoho. Ojo: `raw` es «todo lo que pedimos», porque la
 * v8 exige enumerar los campos.
 */
export function mapearRegistro(
  registro: RegistroZoho,
  campos: readonly CampoResuelto[],
): Record<string, unknown> {
  const fila: Record<string, unknown> = {
    zoho_id: registro.id,
    raw: registro,
    zoho_modified_at: leerFechaHora(registro.Modified_Time),
  };

  for (const campo of campos) {
    fila[campo.destino] = leerValor(registro[campo.zohoApiName], campo.tipo);
  }

  return fila;
}
