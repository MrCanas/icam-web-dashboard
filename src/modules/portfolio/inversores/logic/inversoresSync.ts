import type { UserContext } from "@/lib/auth/currentUser";
import {
  fetchRegistrosDeModulo,
  getZohoConfig,
  listarCampos,
  zohoVariablesQueFaltan,
  type ZohoCampo,
  type ZohoConfig,
} from "@/lib/zoho/client";
import {
  abrirSync,
  cerrarSync,
  listarCatalogo,
  marcarLapidas,
  upsertEspejo,
} from "@/modules/portfolio/inversores/data/inversoresRepository";
import { espejosEnOrden, type EspejoZoho } from "@/modules/portfolio/inversores/data/zohoSchema";
import {
  mapearRegistro,
  normalizarTipoFlujo,
  type RegistroZoho,
} from "@/modules/portfolio/inversores/logic/mapearRegistro";
import {
  describirProblemas,
  validarMapeo,
  type MapeoResuelto,
  type ProblemaMapeo,
} from "@/modules/portfolio/inversores/logic/validarMapeo";
import type { InvSyncModuloDetalle, OrigenSync } from "@/modules/portfolio/inversores/types";

/**
 * Zoho CRM → espejo en Supabase.
 *
 * Reglas que gobiernan todo lo de aquí:
 *
 *   1. SOLO LECTURA contra Zoho. Este módulo no escribe nunca en el CRM. La
 *      única escritura del portal hacia Zoho sigue siendo el botón de Avance de
 *      obra, sobre cambios ya aprobados a mano.
 *   2. Un módulo que falla NO aborta los demás. Cinco módulos son cinco formas
 *      distintas de fallar, y quedarse sin flujos no es motivo para quedarse
 *      también sin cuentas.
 *   3. Las lápidas solo se marcan si la lectura del módulo terminó ENTERA. Es
 *      la regla más importante del fichero: barrer tras una lectura a medias
 *      vacía la pestaña sin que nadie se entere.
 */

export type ResultadoSync =
  | {
      ok: true;
      syncId: string;
      /** `parcial` = algún módulo falló, pero el resto está al día. */
      estado: "ok" | "parcial";
      modulos: InvSyncModuloDetalle[];
      duracionMs: number;
      avisos: ProblemaMapeo[];
    }
  // OJO con la forma de este caso: `withAudit` no escribe entrada cuando el
  // resultado trae una clave `error` no nula, que es justo lo que queremos para
  // un fallo total. Por eso el caso `parcial` va arriba, con `estado` y sin
  // `error`: si no, un sync a medias desaparecería del audit_log.
  | { ok: false; syncId: string | null; error: string; problemas?: ProblemaMapeo[] };

export interface OpcionesSync {
  origen: OrigenSync;
  /** Sincronizar solo estos módulos. La salida de emergencia si el cron no cabe. */
  soloModulos?: string[];
  /**
   * Lee de Zoho y cuenta, pero no escribe ni marca lápidas.
   *
   * Es la forma de comprobar un mapeo recién resuelto contra los datos de
   * verdad sin dejar rastro si está mal. Solo desde la CLI.
   */
  dryRun?: boolean;
}

/** Zoho siempre devuelve `id`, pero `Modified_Time` hay que pedirlo. */
const CAMPOS_SISTEMA = ["Modified_Time"] as const;

async function camposDeTodosLosModulos(
  cfg: ZohoConfig,
  modulos: readonly string[],
): Promise<Map<string, ZohoCampo[]>> {
  const mapa = new Map<string, ZohoCampo[]>();
  for (const modulo of modulos) {
    // En serie y no en paralelo: son llamadas a /settings y Zoho limita por
    // minuto. Cinco peticiones seguidas tardan menos que un 429 con reintento.
    mapa.set(modulo, await listarCampos(modulo, cfg));
  }
  return mapa;
}

/**
 * Ajustes que no caben en el mapeo genérico, porque dependen del significado.
 *
 * Solo dos, y los dos en flujos: normalizar el desplegable de tipo, y no dejar
 * el importe a NULL en una columna declarada NOT NULL.
 */
function ajustarFila(
  espejo: EspejoZoho,
  fila: Record<string, unknown>,
  mapeo: MapeoResuelto,
): Record<string, unknown> {
  if (espejo.tabla !== "inv_flujos") return fila;

  const notas =
    mapeo.camposPorModulo.get(espejo.moduloZoho)?.find((c) => c.destino === "tipo_zoho")?.notas ??
    null;

  return {
    ...fila,
    tipo: normalizarTipoFlujo(fila.tipo_zoho as string | null, notas),
    importe: typeof fila.importe === "number" ? fila.importe : 0,
  };
}

/** Enlaces cuyo padre no está en el espejo. Si no baja, hay algo que mirar. */
function contarHuerfanos(
  espejo: EspejoZoho,
  filas: Record<string, unknown>[],
  idsPorTabla: Map<string, Set<string>>,
): number {
  const padres: Record<string, string | undefined> = {
    inv_cuenta_contacto: "inv_cuentas",
    inv_cuenta_promocion: "inv_cuentas",
    inv_flujos: "inv_cuentas",
  };
  const tablaPadre = padres[espejo.tabla];
  const conocidos = tablaPadre ? idsPorTabla.get(tablaPadre) : undefined;
  if (!conocidos || conocidos.size === 0) return 0;

  return filas.filter((f) => {
    const padre = f.cuenta_zoho_id;
    return typeof padre === "string" && !conocidos.has(padre);
  }).length;
}

export async function sincronizarInversores(
  ctx: UserContext,
  opciones: OpcionesSync,
): Promise<ResultadoSync> {
  const faltan = zohoVariablesQueFaltan({ conModulo: false });
  if (faltan.length > 0) {
    return {
      ok: false,
      syncId: null,
      error:
        `La integración con Zoho no está configurada: faltan ${faltan.join(", ")}. ` +
        "Ver docs/inversores/01-zoho.md.",
    };
  }

  const apertura = await abrirSync(ctx, opciones.origen);
  if ("ocupado" in apertura) {
    return {
      ok: false,
      syncId: null,
      error:
        "Ya hay una sincronización en curso. Dos a la vez se marcarían lápidas la una a la otra.",
    };
  }
  if ("error" in apertura) {
    return { ok: false, syncId: null, error: apertura.error };
  }

  const syncId = apertura.id;
  const t0 = Date.now();
  const detalles: InvSyncModuloDetalle[] = [];

  try {
    const cfg = getZohoConfig({ conModulo: false });
    const catalogo = await listarCatalogo(ctx);
    if (catalogo.length === 0) {
      const error = "El catálogo de campos está vacío: ¿falta aplicar la migración 040?";
      await cerrarSync(ctx, syncId, { estado: "error", modulos: [], duracionMs: Date.now() - t0, error });
      return { ok: false, syncId, error };
    }

    const espejos = espejosEnOrden().filter(
      (e) => !opciones.soloModulos || opciones.soloModulos.includes(e.moduloZoho),
    );

    const campos = await camposDeTodosLosModulos(
      cfg,
      espejos.map((e) => e.moduloZoho),
    );
    const mapeo = validarMapeo(catalogo, campos);

    if (!mapeo.ok) {
      const error = `El mapeo de campos no está resuelto: ${describirProblemas(mapeo.bloqueantes)}`;
      await cerrarSync(ctx, syncId, { estado: "error", modulos: [], duracionMs: Date.now() - t0, error });
      return { ok: false, syncId, error, problemas: mapeo.bloqueantes };
    }

    // Los que de verdad hay que recorrer: si el enlace ya trae el correo, el
    // módulo Contacts sobra y no se baja.
    const aplicables = espejos.filter(
      (e) => !e.condicional || (e.moduloZoho === "Contacts" && mapeo.necesitaContacts),
    );

    const idsPorTabla = new Map<string, Set<string>>();
    /** Contactos que aparecen en alguna cuenta. Filtra la bajada de `Contacts`. */
    let contactosReferenciados: Set<string> | null = null;

    for (const espejo of aplicables) {
      const tm = Date.now();
      const resueltos = mapeo.camposPorModulo.get(espejo.moduloZoho) ?? [];
      const detalle: InvSyncModuloDetalle = {
        modulo: espejo.moduloZoho,
        tabla: espejo.tabla,
        leidos: 0,
        escritos: 0,
        lapidas: 0,
        huerfanos: 0,
        ms: 0,
        error: null,
      };

      try {
        const aPedir = [...new Set([...resueltos.map((c) => c.zohoApiName), ...CAMPOS_SISTEMA])];
        // `fetchRegistrosDeModulo` LANZA si agota las páginas en vez de
        // devolver una lista corta. Es lo que hace segura la barrida de
        // lápidas de más abajo: si llegamos aquí, están todos.
        const registros = (await fetchRegistrosDeModulo(
          espejo.moduloZoho,
          aPedir,
          cfg,
        )) as RegistroZoho[];
        detalle.leidos = registros.length;

        let filas = registros.map((r) => ajustarFila(espejo, mapearRegistro(r, resueltos), mapeo));

        if (espejo.moduloZoho === "Contacts" && contactosReferenciados) {
          filas = filas.filter((f) => contactosReferenciados!.has(String(f.zoho_id)));
        }

        if (opciones.dryRun) {
          detalle.escritos = 0;
        } else {
          const conSync = filas.map((f) => ({
            ...f,
            sync_id: syncId,
            sincronizado_at: new Date().toISOString(),
            borrado_at: null,
          }));
          detalle.escritos = await upsertEspejo(ctx, espejo.tabla, conSync);
        }

        idsPorTabla.set(espejo.tabla, new Set(filas.map((f) => String(f.zoho_id))));
        if (espejo.tabla === "inv_cuenta_contacto") {
          contactosReferenciados = new Set(
            filas
              .map((f) => f.contacto_zoho_id)
              .filter((v): v is string => typeof v === "string" && v.length > 0),
          );
        }

        detalle.huerfanos = contarHuerfanos(espejo, filas, idsPorTabla);

        // La barrida, y solo aquí: lectura completa (no lanzó) y con datos. Un
        // módulo que devuelve cero registros es sospechoso de permiso retirado,
        // no de CRM vacío, y barrer sobre eso borraría la tabla entera.
        if (detalle.leidos > 0 && !opciones.dryRun) {
          detalle.lapidas = await marcarLapidas(ctx, espejo.tabla, syncId);
        }
      } catch (err) {
        detalle.error = err instanceof Error ? err.message : String(err);
      }

      detalle.ms = Date.now() - tm;
      detalles.push(detalle);
    }

    const fallidos = detalles.filter((d) => d.error);
    const estado = fallidos.length === 0 ? "ok" : "parcial";
    const duracionMs = Date.now() - t0;

    await cerrarSync(ctx, syncId, {
      estado,
      modulos: detalles,
      duracionMs,
      error: fallidos.length > 0 ? `${fallidos.length} módulo(s) fallaron` : null,
    });

    return { ok: true, syncId, estado, modulos: detalles, duracionMs, avisos: mapeo.avisos };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await cerrarSync(ctx, syncId, {
      estado: "error",
      modulos: detalles,
      duracionMs: Date.now() - t0,
      error,
    });
    return { ok: false, syncId, error };
  }
}
