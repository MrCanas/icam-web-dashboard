import type {
  InvContactoRow,
  InvCuentaContactoRow,
  InvCuentaPromocionRow,
  InvCuentaRow,
  InvPromocionRow,
} from "@/modules/portfolio/inversores/types";
import { dominioDe, esEmailValido, posibleErrata } from "@/modules/comunicaciones/logic/direcciones";
import {
  ETIQUETA_ROL,
  type Audiencia,
  type Aviso,
  type DestinatarioCalculado,
  type Direccion,
  type OpcionPromocion,
  type RecuentoAudiencias,
  type ResumenDestinatarios,
  type RolContacto,
} from "@/modules/comunicaciones/types";

/**
 * A quién va una comunicación.
 *
 * Todo lo de aquí es puro: recibe las filas del espejo de Inversores y devuelve
 * la lista, sin llamar a nadie. Es la parte que no puede fallar en silencio —un
 * destinatario de más es un correo que ya no se recupera— y por eso es la que
 * se prueba sin base de datos ni credenciales.
 */

export interface EspejosDeContacto {
  cuentas: InvCuentaRow[];
  contactos: InvContactoRow[];
  cuentaContacto: InvCuentaContactoRow[];
  promociones: InvPromocionRow[];
  cuentaPromocion: InvCuentaPromocionRow[];
}

export interface SeleccionAudiencia {
  audiencia: Audiencia;
  /** Obligatorio si la audiencia es `promocion`. */
  promocionZohoId?: string | null;
}

export interface OpcionesDestinatarios {
  rolesPara: readonly RolContacto[];
  rolesCopia: readonly RolContacto[];
  /** Dominios propios: sus direcciones se marcan como internas. */
  dominiosInternos: readonly string[];
  /**
   * Dominios que, preguntado el DNS, no reciben correo. Una cuenta con una
   * dirección ahí nace excluida. Sin esto no se comprueba (pruebas, o DNS caído).
   */
  dominiosSinCorreo?: ReadonlySet<string>;
}

function porNombre(a: { nombre: string }, b: { nombre: string }): number {
  return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
}

/** Cuentas con suscripción a cada promoción, sin contar dos veces la misma. */
function cuentasPorPromocion(
  cuentaPromocion: readonly InvCuentaPromocionRow[],
  cuentasVivas: ReadonlySet<string>,
): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const enlace of cuentaPromocion) {
    if (!enlace.promocion_zoho_id || !enlace.cuenta_zoho_id) continue;
    if (!cuentasVivas.has(enlace.cuenta_zoho_id)) continue;
    const grupo = mapa.get(enlace.promocion_zoho_id) ?? new Set<string>();
    grupo.add(enlace.cuenta_zoho_id);
    mapa.set(enlace.promocion_zoho_id, grupo);
  }
  return mapa;
}

/**
 * Las cuentas de una audiencia.
 *
 * «Inversores directos» son las cuentas con «Tiene intermediario» en `false`.
 * Una cuenta con el dato a `null` (todavía sin sincronizar) NO entra: ante la
 * duda no se le escribe, y `contarAudiencias` dice cuántas son para que se vea.
 *
 * Las cuentas de prueba (`excluida`) SÍ salen de aquí. No se filtran en
 * silencio: aparecen en la lista, marcadas y excluidas, para que quien revisa
 * vea que existen y que no van a recibir nada.
 */
export function cuentasDeAudiencia(
  espejos: EspejosDeContacto,
  seleccion: SeleccionAudiencia,
): InvCuentaRow[] {
  const { cuentas } = espejos;

  switch (seleccion.audiencia) {
    case "toda_la_base":
      return [...cuentas].sort(porNombre);
    case "inversores_directos":
      return cuentas.filter((c) => c.tiene_intermediario === false).sort(porNombre);
    case "promocion": {
      if (!seleccion.promocionZohoId) return [];
      const vivas = new Set(cuentas.map((c) => c.zoho_id));
      const enPromocion =
        cuentasPorPromocion(espejos.cuentaPromocion, vivas).get(seleccion.promocionZohoId) ??
        new Set<string>();
      return cuentas.filter((c) => enPromocion.has(c.zoho_id)).sort(porNombre);
    }
    default:
      return [];
  }
}

export function contarAudiencias(espejos: EspejosDeContacto): RecuentoAudiencias {
  const vivas = new Set(espejos.cuentas.map((c) => c.zoho_id));
  const porPromocion = cuentasPorPromocion(espejos.cuentaPromocion, vivas);

  const promociones: OpcionPromocion[] = espejos.promociones
    .map((p) => ({
      zohoId: p.zoho_id,
      nombre: p.nombre,
      codigo: p.codigo,
      numCuentas: porPromocion.get(p.zoho_id)?.size ?? 0,
    }))
    // Una promoción sin ninguna cuenta no es una audiencia.
    .filter((p) => p.numCuentas > 0)
    .sort(porNombre);

  return {
    todaLaBase: espejos.cuentas.length,
    inversoresDirectos: espejos.cuentas.filter((c) => c.tiene_intermediario === false).length,
    sinDatoIntermediario: espejos.cuentas.filter(
      (c) => c.tiene_intermediario === null || c.tiene_intermediario === undefined,
    ).length,
    promociones,
  };
}

function rolesDe(enlace: InvCuentaContactoRow): RolContacto[] {
  const roles: RolContacto[] = [];
  if (enlace.es_principal) roles.push("principal");
  if (enlace.es_secundario) roles.push("secundario");
  if (enlace.es_representante_legal) roles.push("representante_legal");
  if (enlace.es_abogado) roles.push("abogado");
  if (enlace.es_intermediario) roles.push("intermediario");
  return roles;
}

export function esDireccionInterna(email: string, dominiosInternos: readonly string[]): boolean {
  const dominio = email.split("@")[1]?.trim().toLowerCase();
  if (!dominio) return false;
  return dominiosInternos.some((d) => d.trim().toLowerCase() === dominio);
}

/**
 * Calcula el destinatario de cada cuenta: quién va en «Para», quién en copia y
 * qué hay que mirar antes de enviar.
 *
 * Reglas, las mismas que el kiosk actual:
 *   · un contacto puede tener varios papeles a la vez;
 *   · va en «Para» si alguno de sus papeles está entre los elegidos; si no, y
 *     alguno está entre los de copia, va en copia. Nadie va en los dos;
 *   · sin correo o dado de baja no va en ninguno, y se avisa;
 *   · el correo sale SIEMPRE de `inv_contactos`: el `Email` del enlace viene
 *     vacío en el CRM (ver docs/inversores/01-zoho.md).
 *
 * Una cuenta que se queda sin nadie en «Para» sigue en la lista, con el aviso
 * `sin_destinatario`: que no reciba nada tiene que verse, no deducirse.
 */
export function resolverDestinatarios(
  cuentas: readonly InvCuentaRow[],
  espejos: Pick<EspejosDeContacto, "contactos" | "cuentaContacto">,
  opciones: OpcionesDestinatarios,
): DestinatarioCalculado[] {
  const contactoPorId = new Map(espejos.contactos.map((c) => [c.zoho_id, c]));
  const enlacesPorCuenta = new Map<string, InvCuentaContactoRow[]>();
  for (const enlace of espejos.cuentaContacto) {
    if (!enlace.cuenta_zoho_id) continue;
    const grupo = enlacesPorCuenta.get(enlace.cuenta_zoho_id) ?? [];
    grupo.push(enlace);
    enlacesPorCuenta.set(enlace.cuenta_zoho_id, grupo);
  }

  const calculados = cuentas.map((cuenta): DestinatarioCalculado => {
    const para: Direccion[] = [];
    const copia: Direccion[] = [];
    const avisos = new Set<Aviso>();

    for (const enlace of enlacesPorCuenta.get(cuenta.zoho_id) ?? []) {
      const roles = rolesDe(enlace);
      const vaEnPara = roles.some((r) => opciones.rolesPara.includes(r));
      const vaEnCopia = !vaEnPara && roles.some((r) => opciones.rolesCopia.includes(r));
      if (!vaEnPara && !vaEnCopia) continue;

      const contacto = enlace.contacto_zoho_id ? contactoPorId.get(enlace.contacto_zoho_id) : undefined;
      const email = contacto?.email?.trim().toLowerCase() ?? "";
      if (!email) {
        avisos.add("sin_correo");
        continue;
      }
      // Una dirección mal escrita no entra en la lista: no se adivina cuál quiso
      // poner quien la tecleó. Se corrige en el CRM.
      if (!esEmailValido(email)) {
        avisos.add("direccion_mal_formada");
        continue;
      }
      if (contacto?.email_opt_out === true) {
        avisos.add("dado_de_baja");
        continue;
      }
      if (opciones.dominiosSinCorreo?.has(dominioDe(email))) avisos.add("dominio_sin_correo");
      if (posibleErrata(email)) avisos.add("posible_errata");

      const direccion: Direccion = {
        email,
        nombre: contacto?.nombre_completo ?? enlace.contacto_nombre ?? email,
        contactoZohoId: enlace.contacto_zoho_id,
        rol: roles.map((r) => ETIQUETA_ROL[r]).join(" · "),
      };
      const destino = vaEnPara ? para : copia;
      if (!destino.some((d) => d.email === email)) destino.push(direccion);
    }

    // Quien ya está en «Para» no se repite en copia.
    const copiaFinal = copia.filter((c) => !para.some((p) => p.email === c.email));

    if (cuenta.excluida) avisos.add("cuenta_de_prueba");
    if (para.length === 0) avisos.add("sin_destinatario");
    const internas = para.filter((d) => esDireccionInterna(d.email, opciones.dominiosInternos));
    if (internas.length > 0) avisos.add("direccion_interna");

    let excluidoMotivo: string | null = null;
    if (cuenta.excluida) {
      excluidoMotivo = cuenta.excluida_motivo ?? "Cuenta de prueba o técnica";
    } else if (avisos.has("dominio_sin_correo")) {
      excluidoMotivo = "El dominio de alguna de sus direcciones no recibe correo";
    } else if (para.length > 0 && internas.length === para.length) {
      excluidoMotivo = "Todas sus direcciones son internas";
    }

    return {
      cuentaZohoId: cuenta.zoho_id,
      cuentaNombre: cuenta.nombre,
      para,
      copia: copiaFinal,
      avisos: [...avisos],
      excluido: excluidoMotivo !== null,
      excluidoMotivo,
    };
  });

  // Segunda pasada: la misma dirección en «Para» de más de una cuenta. Solo se
  // cuenta entre las que se enviarían; repetirse con una cuenta de prueba no es
  // recibir dos correos.
  const veces = new Map<string, number>();
  for (const d of calculados) {
    if (d.excluido) continue;
    for (const dir of d.para) veces.set(dir.email, (veces.get(dir.email) ?? 0) + 1);
  }
  for (const d of calculados) {
    if (d.excluido) continue;
    if (d.para.some((dir) => (veces.get(dir.email) ?? 0) > 1)) d.avisos.push("persona_repetida");
  }

  return calculados;
}

/** Los totales que se enseñan arriba de la lista y en el historial. */
export function resumirDestinatarios(
  destinatarios: readonly { para: readonly Direccion[]; excluido: boolean }[],
  dominiosInternos: readonly string[],
): ResumenDestinatarios {
  const direcciones = new Set<string>();
  let aEnviar = 0;
  let excluidos = 0;
  let sinDestinatario = 0;

  for (const d of destinatarios) {
    if (d.excluido) {
      excluidos++;
      continue;
    }
    if (d.para.length === 0) {
      sinDestinatario++;
      continue;
    }
    aEnviar++;
    for (const dir of d.para) direcciones.add(dir.email);
  }

  return {
    total: destinatarios.length,
    aEnviar,
    excluidos,
    sinDestinatario,
    direcciones: direcciones.size,
    direccionesExternas: [...direcciones].filter((e) => !esDireccionInterna(e, dominiosInternos))
      .length,
  };
}
