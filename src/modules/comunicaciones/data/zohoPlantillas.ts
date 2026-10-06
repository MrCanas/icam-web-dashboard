import { getZohoConfig, zohoApi, type ZohoConfig } from "@/lib/zoho/client";

/**
 * Plantillas de correo de Zoho CRM. Solo LECTURA.
 *
 * Las plantillas siguen viviendo en el CRM, que es donde el equipo las edita y
 * donde las usa el kiosk «Emails a Fondos/Promos». Aquí se leen para elegirlas
 * y enseñarlas antes de enviar; nunca se modifican.
 *
 * Solo servidor: usa el cliente de Zoho, que lleva el refresh token.
 */

/** Módulos sobre los que tiene sentido una plantilla para inversores. */
export const MODULOS_DE_PLANTILLA = ["Cuentas_de_Inversi_n", "Contacts"] as const;
export type ModuloDePlantilla = (typeof MODULOS_DE_PLANTILLA)[number];

/** `${Módulo.Campo}`, que es como Zoho escribe un campo combinado. */
export const CAMPOS_COMBINADOS_RE = /\$\{[^}]+\}/g;

export interface PlantillaResumen {
  id: string;
  nombre: string;
  modulo: string | null;
  asunto: string | null;
  carpeta: string | null;
  modificadaAt: string | null;
  /** La respuesta de Zoho tal cual, para diagnóstico desde la CLI. */
  crudo: Record<string, unknown>;
}

export interface Plantilla extends PlantillaResumen {
  html: string;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function nombreDe(v: unknown): string | null {
  if (typeof v === "string") return texto(v);
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    return texto(o.api_name) ?? texto(o.name);
  }
  return null;
}

function aResumen(crudo: Record<string, unknown>): PlantillaResumen {
  return {
    id: String(crudo.id ?? ""),
    nombre: texto(crudo.name) ?? "(sin nombre)",
    modulo: nombreDe(crudo.module),
    asunto: texto(crudo.subject),
    carpeta: nombreDe(crudo.folder),
    modificadaAt: texto(crudo.modified_time),
    crudo,
  };
}

interface ListaRespuesta {
  email_templates?: Record<string, unknown>[];
  info?: { more_records?: boolean; page?: number };
}

/**
 * Plantillas de un módulo, paginando hasta el final.
 *
 * Como `fetchRegistrosDeModulo`, LANZA al agotar las páginas en vez de devolver
 * una lista corta: una plantilla que no aparece en el selector parece borrada.
 */
export async function listarPlantillas(
  modulo: string,
  cfg: ZohoConfig = getZohoConfig({ conModulo: false }),
): Promise<PlantillaResumen[]> {
  const salida: PlantillaResumen[] = [];
  const maxPaginas = 20;

  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    const params = new URLSearchParams({ module: modulo, page: String(pagina), per_page: "200" });
    const r = await zohoApi<ListaRespuesta>(`/settings/email_templates?${params}`, undefined, cfg);
    salida.push(...(r.email_templates ?? []).map(aResumen));
    if (!r.info?.more_records) return salida;
  }

  throw new Error(`Se alcanzó el límite de ${maxPaginas} páginas leyendo plantillas de ${modulo}.`);
}

export async function leerPlantilla(
  id: string,
  cfg: ZohoConfig = getZohoConfig({ conModulo: false }),
): Promise<Plantilla> {
  const r = await zohoApi<ListaRespuesta>(
    `/settings/email_templates/${encodeURIComponent(id)}`,
    undefined,
    cfg,
  );
  const crudo = r.email_templates?.[0];
  if (!crudo) throw new Error(`Zoho no devolvió la plantilla ${id}.`);
  return { ...aResumen(crudo), html: typeof crudo.content === "string" ? crudo.content : "" };
}
