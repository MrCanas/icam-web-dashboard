/**
 * Descubre cómo se llaman de verdad los campos de los módulos de Inversores.
 *
 * Hermano de `scripts/pm/zoho-explore.ts` y con la misma filosofía: nadie tiene
 * que averiguar los nombres API a mano, Zoho los expone. Aquí además se cruzan
 * con la forma del espejo (`ESPEJOS`) y se propone el mapeo que vive en
 * `inv_campo_catalogo`.
 *
 * Solo LEE de Zoho. Lo único que escribe, y solo con `--aplicar`, es el mapeo
 * en nuestra propia base.
 *
 *   npm run inversores:zoho-descubrir                # módulos y estado del mapeo
 *   npm run inversores:zoho-descubrir -- --campos    # todos los campos de cada módulo
 *   npm run inversores:zoho-descubrir -- --muestra 3 # registros de ejemplo, ya mapeados
 *   npm run inversores:zoho-descubrir -- --aplicar   # guarda la propuesta
 *   npm run inversores:zoho-descubrir -- --forzar    # reevalúa también lo ya resuelto
 *
 * Lo que ya tiene `zoho_api_name` en la tabla NO se toca sin `--forzar`: el
 * mapeo bueno lo sembró la migración 040 mirando el CRM de verdad, y la
 * heurística es un ayudante para lo que falta, no una autoridad.
 */
import { cargarEnv, ficherosEnvPresentes } from "../pm/lib/env";
import type { UserContext } from "@/lib/auth/currentUser";
import {
  esCampoEscribible,
  fetchRegistrosDeModulo,
  getZohoConfig,
  listarCampos,
  listarModulos,
  usuarioActual,
  zohoVariablesQueFaltan,
  type ZohoCampo,
} from "@/lib/zoho/client";
import {
  guardarResolucionCatalogo,
  listarCatalogo,
  type ResolucionCampo,
} from "@/modules/portfolio/inversores/data/inversoresRepository";
import { ESPEJOS, ORDEN_SYNC } from "@/modules/portfolio/inversores/data/zohoSchema";
import { mapearRegistro } from "@/modules/portfolio/inversores/logic/mapearRegistro";
import { validarMapeo } from "@/modules/portfolio/inversores/logic/validarMapeo";
import type { CampoResuelto } from "@/modules/portfolio/inversores/logic/mapearRegistro";

/** El script escribe con service role; el email es para la traza de auditoría. */
const CTX: UserContext = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "inversores-script@imparcapital.com",
  name: "Script inversores:zoho-descubrir",
  zones: [],
  isPlatformAdmin: false,
  deniedRouteKeys: [],
};

function tabla(campos: ZohoCampo[]): void {
  const anchoApi = Math.max(8, ...campos.map((c) => c.api_name.length));
  const anchoLbl = Math.max(9, ...campos.map((c) => c.field_label.length));
  console.log(`  esc  ${"api_name".padEnd(anchoApi)}  ${"etiqueta".padEnd(anchoLbl)}  tipo`);
  for (const c of campos) {
    console.log(
      `  ${esCampoEscribible(c) ? " ✎ " : " · "}  ${c.api_name.padEnd(anchoApi)}  ` +
        `${c.field_label.padEnd(anchoLbl)}  ${c.data_type}`,
    );
  }
}

/**
 * Campos que Zoho pone en todos los módulos y que nunca son el dato de negocio.
 *
 * Sin este filtro la heurística resolvía sola `estado` → `Record_Status__s`
 * («Record Status»: Trash/Available/Draft), que no significa nada para el
 * portal pero casa con la pista de «status».
 */
const SISTEMA = new Set([
  "Owner",
  "Tag",
  "Exchange_Rate",
  "Currency",
  "Record_Image",
  "Unsubscribed_Mode",
  "Unsubscribed_Time",
  "id",
  "Created_By",
  "Modified_By",
  "Created_Time",
  "Modified_Time",
  "Last_Activity_Time",
]);

function esCampoDeSistema(c: ZohoCampo): boolean {
  // Los `__s` son los campos internos de la plataforma (Record_Status__s,
  // Locked__s, Tag__s…). Ninguno es dato de negocio.
  return c.api_name.endsWith("__s") || SISTEMA.has(c.api_name);
}

/** Candidatos de un campo nuestro entre los que Zoho dice tener. */
function candidatos(
  pistas: readonly RegExp[],
  campos: ZohoCampo[],
  columna: string,
): ZohoCampo[] {
  // `moneda` es la excepción: ahí el campo de sistema `Currency` SÍ es el dato.
  const admisibles = columna === "moneda" ? campos : campos.filter((c) => !esCampoDeSistema(c));
  if (pistas.length === 0) return [];
  return admisibles.filter((c) => pistas.some((p) => p.test(c.field_label) || p.test(c.api_name)));
}

async function main(): Promise<void> {
  cargarEnv();

  // Inversores no necesita ZOHO_MODULO_PROMOCIONES: lee módulos por nombre.
  const faltan = zohoVariablesQueFaltan({ conModulo: false });
  if (faltan.length > 0) {
    console.error(
      `Faltan variables de entorno: ${faltan.join(", ")}\n` +
        `Ficheros leídos: ${ficherosEnvPresentes().join(", ") || "ninguno"}\n` +
        "Consíguelas con:  npm run pm:zoho-auth -- --dc eu\n" +
        "Ver docs/inversores/01-zoho.md.",
    );
    process.exitCode = 1;
    return;
  }

  const cfg = getZohoConfig({ conModulo: false });
  console.log(`centro de datos: ${cfg.apiDomain}`);

  // Saber a quién pertenece el token ayuda a explicar un 403 más adelante (el
  // token hereda SUS permisos), pero /users pide el scope ZohoCRM.users.READ y
  // el nuestro no lo incluye a propósito: no hace falta para leer módulos. Si
  // no se puede, se sigue — informativo no es lo mismo que imprescindible.
  try {
    const yo = await usuarioActual(cfg);
    if (yo) console.log(`token de: ${yo.full_name} <${yo.email}> · perfil ${yo.profile?.name ?? "?"}`);
  } catch {
    console.log("token de: (no se puede saber sin el scope ZohoCRM.users.READ)");
  }
  console.log("");

  // 1. ¿Están los módulos que esperamos?
  const modulos = (await listarModulos(cfg)).filter((m) => m.api_supported);
  const nombres = new Set(modulos.map((m) => m.api_name));
  const faltantes = ORDEN_SYNC.filter((m) => !nombres.has(m));
  console.log(`Módulos accesibles por API: ${modulos.length}`);
  for (const esperado of ORDEN_SYNC) {
    console.log(`  ${nombres.has(esperado) ? "✓" : "✗"} ${esperado}`);
  }
  if (faltantes.length > 0) {
    console.log(
      `\n⚠ No se ven ${faltantes.join(", ")}. O el nombre API es otro, o el usuario del token no ` +
        "tiene permiso sobre ese módulo. Los nombres de la lista completa:\n",
    );
    for (const m of modulos) console.log(`    ${m.api_name.padEnd(30)} ${m.plural_label}`);
  }

  // 2. Los campos de cada módulo.
  const campos = new Map<string, ZohoCampo[]>();
  for (const espejo of ESPEJOS) {
    if (!nombres.has(espejo.moduloZoho)) continue;
    campos.set(espejo.moduloZoho, await listarCampos(espejo.moduloZoho, cfg));
  }

  if (process.argv.includes("--campos")) {
    for (const [modulo, lista] of campos) {
      console.log(`\n\nCampos de «${modulo}» (${lista.length}):\n`);
      tabla(lista);
      for (const c of lista) {
        if (c.pick_list_values?.length) {
          console.log(
            `\n    valores de ${c.api_name}: ${c.pick_list_values.map((v) => v.display_value).join(" · ")}`,
          );
        }
      }
    }
  }

  // 3. La propuesta de mapeo.
  //
  // Lo ya resuelto en la tabla NO se toca salvo con --forzar. El mapeo bueno lo
  // sembró la migración 040 tras mirar el CRM de verdad, y la heurística es un
  // ayudante para lo que falta, no una autoridad: dejarla sobrescribir sería
  // cambiar un mapeo correcto por una conjetura, en silencio.
  const forzar = process.argv.includes("--forzar");
  const yaResuelto = new Set(
    (await listarCatalogo(CTX))
      .filter((c) => c.zoho_api_name)
      .map((c) => `${c.modulo}::${c.destino}`),
  );

  console.log("\n\nMapeo propuesto contra inv_campo_catalogo:\n");
  const resoluciones: ResolucionCampo[] = [];
  let ambiguos = 0;
  let sinCandidato = 0;
  let respetados = 0;

  for (const espejo of ESPEJOS) {
    const lista = campos.get(espejo.moduloZoho);
    if (!lista) {
      console.log(`\n  ${espejo.moduloZoho}: módulo no accesible, se salta`);
      continue;
    }
    console.log(`\n  ${espejo.moduloZoho} → ${espejo.tabla}`);

    for (const columna of espejo.columnas) {
      const marca = columna.obligatorio ? "*" : " ";

      if (!forzar && yaResuelto.has(`${espejo.moduloZoho}::${columna.columna}`)) {
        respetados += 1;
        console.log(`   ${marca} · ${columna.columna.padEnd(22)} ya resuelto en la tabla`);
        continue;
      }

      const posibles = candidatos(columna.pistas, lista, columna.columna);

      if (posibles.length === 0) {
        sinCandidato += 1;
        console.log(`   ${marca} ✗ ${columna.columna.padEnd(22)} sin candidato`);
        continue;
      }
      if (posibles.length > 1) {
        ambiguos += 1;
        console.log(
          `   ${marca} ? ${columna.columna.padEnd(22)} ${posibles
            .map((p) => `${p.api_name} («${p.field_label}»)`)
            .join("  |  ")}`,
        );
        // Ambiguo NO se resuelve solo: elegir al azar entre dos campos de
        // dinero es exactamente cómo se cuela un KPI que miente.
        continue;
      }

      const elegido = posibles[0];
      console.log(
        `   ${marca} ✓ ${columna.columna.padEnd(22)} ${elegido.api_name} («${elegido.field_label}», ${elegido.data_type})`,
      );
      resoluciones.push({
        modulo: espejo.moduloZoho,
        destino: columna.columna,
        zoho_api_name: elegido.api_name,
        zoho_label: elegido.field_label,
        zoho_data_type: elegido.data_type,
      });
    }
  }

  console.log(
    `\n  (*) obligatorio · ${respetados} ya en la tabla · ${resoluciones.length} propuestos · ` +
      `${ambiguos} ambiguos · ${sinCandidato} sin candidato`,
  );
  if (respetados > 0 && !forzar) {
    console.log("  Lo ya resuelto no se toca. Con --forzar se reevalúa todo.");
  }
  if (ambiguos + sinCandidato > 0) {
    console.log(
      "  Los ambiguos y los que no tienen candidato hay que ponerlos a mano en inv_campo_catalogo\n" +
        "  (columna zoho_api_name), mirando la tabla de campos de --campos.",
    );
  }

  // 4. Guardar, si se pide.
  if (process.argv.includes("--aplicar")) {
    const guardado = await guardarResolucionCatalogo(CTX, resoluciones);
    console.log(
      guardado.ok
        ? `\n✓ Guardadas ${guardado.guardadas} resoluciones en inv_campo_catalogo.`
        : `\n✗ No se pudo guardar: ${guardado.error}`,
    );
  } else {
    console.log("\n  (dry-run: nada escrito. Añade --aplicar para guardarlo.)");
  }

  // 5. ¿Arrancaría el sync?
  const catalogo = await listarCatalogo(CTX);
  if (catalogo.length === 0) {
    console.log("\n⚠ inv_campo_catalogo está vacío: falta aplicar la migración 040.");
  } else {
    const validacion = validarMapeo(catalogo, campos);
    console.log(
      validacion.ok
        ? "\n✓ El mapeo está completo: el sync puede arrancar."
        : `\n✗ El sync NO arrancaría todavía:\n${validacion.bloqueantes
            .map((b) => `    · ${b.modulo}.${b.columna}: ${b.detalle}`)
            .join("\n")}`,
    );
    for (const aviso of validacion.avisos) {
      console.log(`  ⚠ ${aviso.modulo}.${aviso.columna}: ${aviso.detalle}`);
    }

    // 6. Una muestra ya mapeada, que es lo que de verdad delata un mapeo malo.
    const iMuestra = process.argv.indexOf("--muestra");
    if (iMuestra >= 0) {
      const n = Number(process.argv[iMuestra + 1] ?? 3);
      for (const [modulo, resueltos] of validacion.camposPorModulo) {
        if (resueltos.length === 0) continue;
        console.log(`\n\nMuestra de «${modulo}»:\n`);
        try {
          const registros = await fetchRegistrosDeModulo(
            modulo,
            [...resueltos.map((c: CampoResuelto) => c.zohoApiName), "Modified_Time"],
            cfg,
            { porPagina: Math.min(Math.max(n, 1), 200), maxPaginas: 1 },
          );
          for (const registro of registros.slice(0, n)) {
            const { raw: _raw, ...mapeado } = mapearRegistro(registro, resueltos);
            console.log(JSON.stringify(mapeado, null, 2));
            console.log("---");
          }
        } catch (err) {
          console.log(`  ✗ ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
