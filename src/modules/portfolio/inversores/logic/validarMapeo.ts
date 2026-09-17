import type { ZohoCampo } from "@/lib/zoho/client";
import { ESPEJOS, type EspejoZoho } from "@/modules/portfolio/inversores/data/zohoSchema";
import type { CampoResuelto } from "@/modules/portfolio/inversores/logic/mapearRegistro";
import type { InvCampoCatalogoRow } from "@/modules/portfolio/inversores/types";

/**
 * La puerta que hay que pasar antes de tocar una sola tabla espejo.
 *
 * Existe porque el modo de fallo natural de este sync es silencioso: con un
 * `api_name` sin resolver, `registro[undefined]` es `undefined`, la columna se
 * escribe a NULL y la pestaña enseña un cero que parece un dato. Más vale un
 * sync que se niega a arrancar nombrando el campo que falta.
 *
 * Es pura: recibe el catálogo y los campos que Zoho dice tener, y no llama a
 * nadie. Así se puede probar sin credenciales.
 */

export type ClaseProblema =
  | "sin_resolver"
  | "campo_desaparecido"
  | "etiqueta_cambiada";

export interface ProblemaMapeo {
  modulo: string;
  columna: string;
  clase: ClaseProblema;
  detalle: string;
}

export interface MapeoResuelto {
  /** Módulo de Zoho → campos que hay que pedir y dónde va cada uno. */
  camposPorModulo: Map<string, CampoResuelto[]>;
  bloqueantes: ProblemaMapeo[];
  avisos: ProblemaMapeo[];
  ok: boolean;
}

function clave(modulo: string, destino: string): string {
  return `${modulo}::${destino}`;
}

export function validarMapeo(
  catalogo: readonly InvCampoCatalogoRow[],
  camposDeZoho?: ReadonlyMap<string, readonly ZohoCampo[]>,
): MapeoResuelto {
  const porClave = new Map(catalogo.map((c) => [clave(c.modulo, c.destino), c]));
  const espejosAplicables: readonly EspejoZoho[] = ESPEJOS;

  const bloqueantes: ProblemaMapeo[] = [];
  const avisos: ProblemaMapeo[] = [];
  const camposPorModulo = new Map<string, CampoResuelto[]>();

  for (const espejo of espejosAplicables) {
    const deZoho = camposDeZoho?.get(espejo.moduloZoho);
    const porApiName = deZoho ? new Map(deZoho.map((c) => [c.api_name, c])) : null;
    const resueltos: CampoResuelto[] = [];

    for (const columna of espejo.columnas) {
      const fila = porClave.get(clave(espejo.moduloZoho, columna.columna));
      const apiName = fila?.zoho_api_name?.trim();

      if (!apiName) {
        if (columna.obligatorio) {
          bloqueantes.push({
            modulo: espejo.moduloZoho,
            columna: columna.columna,
            clase: "sin_resolver",
            detalle:
              `No se sabe qué campo de Zoho alimenta «${columna.columna}». ` +
              "Resuélvelo con: npm run inversores:zoho-descubrir -- --aplicar",
          });
        }
        continue;
      }

      // Solo se puede comprobar si nos han pasado lo que Zoho dice tener.
      if (porApiName) {
        const campo = porApiName.get(apiName);
        if (!campo) {
          const problema: ProblemaMapeo = {
            modulo: espejo.moduloZoho,
            columna: columna.columna,
            clase: "campo_desaparecido",
            detalle:
              `El campo «${apiName}» ya no existe en ${espejo.moduloZoho}. ` +
              "Alguien lo ha borrado o renombrado en el CRM.",
          };
          // Pedirle a la v8 un campo inexistente devuelve 400 y tumba la lectura
          // entera del módulo, así que esto bloquea aunque la columna sea
          // opcional: opcional es el DATO, no el campo roto.
          bloqueantes.push(problema);
          continue;
        }
        if (fila?.zoho_label && campo.field_label !== fila.zoho_label) {
          avisos.push({
            modulo: espejo.moduloZoho,
            columna: columna.columna,
            clase: "etiqueta_cambiada",
            detalle:
              `«${apiName}» se llamaba «${fila.zoho_label}» y ahora «${campo.field_label}». ` +
              "El api_name no ha cambiado, así que el sync sigue valiendo; conviene mirar por qué.",
          });
        }
      }

      resueltos.push({
        destino: columna.columna,
        zohoApiName: apiName,
        tipo: columna.tipo,
        notas: fila?.notas ?? null,
      });
    }

    camposPorModulo.set(espejo.moduloZoho, resueltos);
  }

  return {
    camposPorModulo,
    bloqueantes,
    avisos,
    ok: bloqueantes.length === 0,
  };
}

/** Mensaje de una línea por problema, para el log y el correo de aviso. */
export function describirProblemas(problemas: readonly ProblemaMapeo[]): string {
  return problemas.map((p) => `${p.modulo}.${p.columna}: ${p.detalle}`).join(" | ");
}
