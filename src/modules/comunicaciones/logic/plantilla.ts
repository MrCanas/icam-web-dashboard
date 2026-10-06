/**
 * Vista previa de una plantilla de Zoho con los datos de un registro.
 *
 * Zoho escribe los campos combinados como `${!Módulo.Api_name}` —con el nombre
 * API del campo, no su etiqueta— y los resuelve él al enviar. Aquí se imita esa
 * sustitución para enseñar el correo antes de que salga.
 *
 * Es una IMITACIÓN y se dice en pantalla: lo que no se sabe resolver se marca
 * en rojo en vez de dejarlo pasar como si estuviera bien. La comprobación fiel
 * es el envío de prueba, que hace el propio Zoho.
 *
 * Puro: recibe el HTML y el registro, no llama a nadie.
 */

export interface VistaPrevia {
  asunto: string;
  html: string;
  /** Campos que no se han podido sustituir: otro módulo, o un campo que el registro no trae. */
  sinResolver: string[];
  /** Campos que existen pero están vacíos en este registro: «Estimado ,». */
  vacios: string[];
}

const CAMPO_RE = /\$\{!?([^.}\s]+)\.([^}]+)\}/g;

function escaparHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Un valor de Zoho como texto: los lookups y usuarios llegan como `{ id, name }`. */
function comoTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(comoTexto).filter(Boolean).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.name === "string") return o.name;
  }
  return "";
}

/**
 * Tipos de campo de Zoho cuyo valor es el mismo texto que Zoho escribiría.
 *
 * Los demás (importes, fechas, números, listas múltiples, lookups) Zoho los
 * formatea a su manera —separador de miles, símbolo de moneda, orden de la
 * fecha— y aquí no se sabe reproducirlo con garantía. Un campo de esos NO se
 * resuelve: el correo que lo use no sale, que es mejor que salir con un importe
 * mal escrito.
 */
export const TIPOS_DE_CAMPO_ADMITIDOS: readonly string[] = [
  "text",
  "textarea",
  "email",
  "phone",
  "website",
  "picklist",
  "autonumber",
];

function sustituir(
  texto: string,
  modulo: string,
  registro: Record<string, unknown>,
  comoHtml: boolean,
  sinResolver: Set<string>,
  vacios: Set<string>,
  tipos: ReadonlyMap<string, string> | undefined,
): string {
  return texto.replace(CAMPO_RE, (original: string, moduloCampo: string, campo: string) => {
    const clave = campo.trim();
    const tipo = tipos?.get(clave);
    const tipoAdmitido = !tipos || (tipo !== undefined && TIPOS_DE_CAMPO_ADMITIDOS.includes(tipo));
    if (moduloCampo !== modulo || !(clave in registro) || !tipoAdmitido) {
      sinResolver.add(original);
      return comoHtml
        ? `<span style="background:#fde2e2;color:#9B3B3B;padding:0 2px">${escaparHtml(original)}</span>`
        : original;
    }
    const valor = comoTexto(registro[clave]);
    if (!valor) vacios.add(original);
    return comoHtml ? escaparHtml(valor) : valor;
  });
}

/**
 * La plantilla con los campos combinados de un registro.
 *
 * Con `tipos` (nombre API → tipo de campo en Zoho) solo se resuelven los campos
 * de un tipo admitido; es como se llama para ENVIAR. Sin `tipos` se resuelve
 * todo lo que traiga el registro, que es el comportamiento antiguo de la vista
 * previa.
 *
 * Cualquier expresión `${…}` que no tenga la forma `${!Módulo.Campo}` (la firma
 * del usuario, campos de otro módulo) se queda como está y cuenta como sin
 * resolver.
 */
export function renderizarPlantilla(
  plantilla: { asunto: string | null; html: string },
  modulo: string,
  registro: Record<string, unknown>,
  tipos?: ReadonlyMap<string, string>,
): VistaPrevia {
  const sinResolver = new Set<string>();
  const vacios = new Set<string>();
  const asunto = sustituir(plantilla.asunto ?? "", modulo, registro, false, sinResolver, vacios, tipos);
  const html = sustituir(plantilla.html, modulo, registro, true, sinResolver, vacios, tipos);
  // Lo que quede con forma de campo combinado y no haya pasado por arriba.
  for (const resto of `${asunto}\n${html.replace(/<span style="background:#fde2e2[^>]*>[^<]*<\/span>/g, "")}`.match(
    /\$\{[^}]*\}/g,
  ) ?? []) {
    sinResolver.add(resto);
  }
  return { asunto, html, sinResolver: [...sinResolver], vacios: [...vacios] };
}
