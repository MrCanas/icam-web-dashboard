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

function sustituir(
  texto: string,
  modulo: string,
  registro: Record<string, unknown>,
  comoHtml: boolean,
  sinResolver: Set<string>,
  vacios: Set<string>,
): string {
  return texto.replace(CAMPO_RE, (original: string, moduloCampo: string, campo: string) => {
    const clave = campo.trim();
    if (moduloCampo !== modulo || !(clave in registro)) {
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

export function renderizarPlantilla(
  plantilla: { asunto: string | null; html: string },
  modulo: string,
  registro: Record<string, unknown>,
): VistaPrevia {
  const sinResolver = new Set<string>();
  const vacios = new Set<string>();
  return {
    asunto: sustituir(plantilla.asunto ?? "", modulo, registro, false, sinResolver, vacios),
    html: sustituir(plantilla.html, modulo, registro, true, sinResolver, vacios),
    sinResolver: [...sinResolver],
    vacios: [...vacios],
  };
}
