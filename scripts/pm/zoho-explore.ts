/**
 * Descubre qué hay realmente en el Zoho de ICAM.
 *
 * No hace falta que nadie averigüe los nombres API a mano: Zoho los expone.
 * Este script los pregunta y propone el mapeo contra pm_avance_fase_catalogo.
 *
 * Solo LEE de Zoho y no escribe nada, ni en Zoho ni en la base.
 *
 *   npm run pm:zoho-explore                 # lista los módulos disponibles
 *   npm run pm:zoho-explore -- --campos     # campos del módulo configurado
 *   npm run pm:zoho-explore -- --muestra 5  # 5 registros de ejemplo
 */
import { loadActasEnv } from "../actas/lib/env";
import {
  esCampoEscribible,
  fetchTodosLosRegistros,
  getZohoConfig,
  listarCampos,
  listarModulos,
  zohoVariablesQueFaltan,
  type ZohoCampo,
} from "../../src/modules/pm/avance/data/zohoClient";

/** Pistas para localizar los campos que nos interesan sin conocer sus nombres. */
const PISTAS: Record<string, RegExp> = {
  "Código de Promoción": /c[oó]digo/i,
  "Nombre Promoción": /nombre|^name$|deal_?name/i,
  Situación: /situaci[oó]n|estado|status|stage/i,
  Tipología: /tipolog|tipo(?!_de_registro)|uso|categor/i,
  "Avance general": /avance.*general|general.*avance|progreso/i,
  "Actuaciones previas y demoliciones": /previas|demolic/i,
  "Movimiento tierras, cimentación y estructura": /tierras|cimentaci|estructura/i,
  Instalaciones: /instalac/i,
  "Obra gris": /obra.*gris/i,
  Acabados: /acabado/i,
  "Recuperación elementos protegidos": /recuperaci|protegid/i,
};

function tabla(campos: ZohoCampo[]): void {
  const anchoApi = Math.max(8, ...campos.map((c) => c.api_name.length));
  const anchoLbl = Math.max(9, ...campos.map((c) => c.field_label.length));
  console.log(
    `  esc  ${"api_name".padEnd(anchoApi)}  ${"etiqueta".padEnd(anchoLbl)}  tipo`,
  );
  for (const c of campos) {
    console.log(
      `  ${esCampoEscribible(c) ? " ✎ " : " · "}  ${c.api_name.padEnd(anchoApi)}  ` +
        `${c.field_label.padEnd(anchoLbl)}  ${c.data_type}`,
    );
  }
  console.log("
  ✎ = escribible por API · · = solo lectura (fórmula, resumen o permisos)");
}

async function main(): Promise<void> {
  loadActasEnv();
  const faltan = zohoVariablesQueFaltan();

  // Los módulos se pueden listar sin saber cuál es el de Promociones.
  const soloModulo = faltan.length === 1 && faltan[0] === "ZOHO_MODULO_PROMOCIONES";
  if (faltan.length > 0 && !soloModulo) {
    console.error(
      `Faltan variables de entorno: ${faltan.join(", ")}\n` +
        "Ver docs/pm/01-avance-obra.md, sección «Conectar la API de Zoho».",
    );
    process.exit(1);
  }

  if (soloModulo) {
    // getZohoConfig() exigiría el módulo; para listar aún no hace falta.
    process.env.ZOHO_MODULO_PROMOCIONES = "(sin definir)";
  }
  const cfg = getZohoConfig();
  console.log(`centro de datos: ${cfg.apiDomain}\n`);

  const quiereCampos = process.argv.includes("--campos");
  const iMuestra = process.argv.indexOf("--muestra");

  if (!quiereCampos && iMuestra < 0) {
    const modulos = (await listarModulos(cfg)).filter((m) => m.api_supported);
    console.log(`Módulos accesibles por API (${modulos.length}):\n`);
    const candidatos = modulos.filter((m) => /promoc/i.test(`${m.api_name} ${m.plural_label}`));
    for (const m of modulos) {
      const marca = candidatos.includes(m) ? "→" : " ";
      console.log(`${marca} ${m.api_name.padEnd(28)} ${m.plural_label}`);
    }
    console.log(
      candidatos.length > 0
        ? `\nCandidato para ZOHO_MODULO_PROMOCIONES: ${candidatos
            .map((c) => c.api_name)
            .join(" o ")}`
        : "\nNinguno se llama «Promociones». Elige el que corresponda de la lista de arriba.",
    );
    console.log("Ponlo en .env.local y vuelve a ejecutar con --campos.");
    return;
  }

  if (soloModulo) {
    console.error("Define ZOHO_MODULO_PROMOCIONES en .env.local antes de usar --campos/--muestra.");
    process.exit(1);
  }

  const campos = await listarCampos(cfg.modulo, cfg);
  console.log(`Campos de «${cfg.modulo}» (${campos.length}):\n`);
  tabla(campos);

  console.log("\n\nMapeo propuesto contra pm_avance_fase_catalogo:\n");
  const sinResolver: string[] = [];
  const noEscribibles: string[] = [];
  for (const [nuestro, patron] of Object.entries(PISTAS)) {
    const posibles = campos.filter(
      (c) => patron.test(c.field_label) || patron.test(c.api_name),
    );
    if (posibles.length === 0) {
      sinResolver.push(nuestro);
      console.log(`  ✗ ${nuestro.padEnd(46)} → sin candidato`);
    } else {
      console.log(
        `  ${posibles.length === 1 ? "✓" : "?"} ${nuestro.padEnd(46)} → ${posibles
          .map((p) => `${p.api_name} (${p.data_type}${esCampoEscribible(p) ? ", escribible" : ", SOLO LECTURA"})`)
          .join("  |  ")}`,
      );
      if (posibles.length === 1 && !esCampoEscribible(posibles[0])) noEscribibles.push(nuestro);
    }
  }

  // Lo que de verdad bloquea el botón «Subir a Zoho»: un campo de fórmula o sin
  // permiso de edición rechaza la escritura por mucho scope OAuth que haya.
  if (noEscribibles.length > 0) {
    console.log(
      `
⚠ ${noEscribibles.length} campo(s) NO se pueden escribir por API: ${noEscribibles.join(", ")}.
` +
        "  Si es data_type=formula, Zoho lo calcula y no admite escritura: hay que decidir si se
" +
        "  deja fuera del envío. Si es por permisos, el usuario que generó el token necesita
" +
        "  edición sobre ese campo en su perfil y en el diseño de página.",
    );
  }

  // La tipología es el motivo de todo esto: si es un desplegable, ver sus
  // valores dice de golpe cuántas hay y si el export venía filtrado.
  const tipologia = campos.find(
    (c) => PISTAS["Tipología"].test(c.field_label) && c.pick_list_values?.length,
  );
  if (tipologia) {
    console.log(
      `\nValores de «${tipologia.field_label}» (${tipologia.pick_list_values!.length}):`,
    );
    for (const v of tipologia.pick_list_values!) console.log(`  · ${v.display_value}`);
  }

  if (sinResolver.length > 0) {
    console.log(
      `\n${sinResolver.length} sin candidato automático: hay que mirarlos en la tabla de campos de arriba.`,
    );
  }

  if (iMuestra >= 0) {
    const n = Number(process.argv[iMuestra + 1] ?? 3);
    const apiNames = campos.slice(0, 40).map((c) => c.api_name);
    const registros = await fetchTodosLosRegistros(apiNames, cfg, { porPagina: Math.min(n, 200), maxPaginas: 1 });
    console.log(`\n\nMuestra de ${Math.min(n, registros.length)} registros:\n`);
    for (const r of registros.slice(0, n)) {
      console.log(JSON.stringify(r, null, 2));
      console.log("---");
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
