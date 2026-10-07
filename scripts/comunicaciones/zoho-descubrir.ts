/**
 * Comprueba qué ve de Zoho el token del portal para el módulo Comunicaciones.
 *
 * Hermano de `scripts/inversores/zoho-descubrir.ts`. Solo LEE: ni escribe en
 * Zoho ni en nuestra base, y no puede enviar ningún correo.
 *
 *   npm run comunicaciones:zoho-descubrir                 # usuario, campos y plantillas
 *   npm run comunicaciones:zoho-descubrir -- --plantilla <id>   # una plantilla entera
 *   npm run comunicaciones:zoho-descubrir -- --crudo      # respuestas tal cual llegan
 */
import { cargarEnv, ficherosEnvPresentes } from "../pm/lib/env";
import {
  getZohoConfig,
  listarCampos,
  usuarioActual,
  zohoVariablesQueFaltan,
} from "@/lib/zoho/client";
import {
  CAMPOS_COMBINADOS_RE,
  leerPlantilla,
  listarPlantillas,
  MODULOS_DE_PLANTILLA,
} from "@/modules/comunicaciones/data/zohoPlantillas";

/** Los dos campos que la migración 047 añade al espejo de Inversores. */
const CAMPOS_NUEVOS: { modulo: string; apiName: string }[] = [
  { modulo: "Cuentas_de_Inversi_n", apiName: "Tiene_intermediario" },
  { modulo: "Contacts", apiName: "Email_Opt_Out" },
];

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function main(): Promise<void> {
  cargarEnv();
  const faltan = zohoVariablesQueFaltan({ conModulo: false });
  if (faltan.length > 0) {
    console.error(`Faltan variables de entorno: ${faltan.join(", ")}`);
    console.error(`Ficheros .env presentes: ${ficherosEnvPresentes().join(", ") || "ninguno"}`);
    process.exit(1);
  }
  const cfg = getZohoConfig({ conModulo: false });
  const crudo = process.argv.includes("--crudo");

  // El token del portal puede no llevar el scope de usuarios: no es motivo para
  // quedarse sin el resto del diagnóstico.
  try {
    const usuario = await usuarioActual(cfg);
    console.log(
      `Token de: ${usuario?.full_name ?? "?"} <${usuario?.email ?? "?"}> · perfil ${usuario?.profile?.name ?? "?"}`,
    );
  } catch (err) {
    console.log(`Token de: no se puede saber (${err instanceof Error ? err.message : String(err)})`);
  }

  console.log("\nCampos nuevos del espejo:");
  for (const { modulo, apiName } of CAMPOS_NUEVOS) {
    const campos = await listarCampos(modulo, cfg);
    const campo = campos.find((c) => c.api_name === apiName);
    console.log(
      campo
        ? `  ✓ ${modulo}.${apiName} — «${campo.field_label}» (${campo.data_type})`
        : `  ✗ ${modulo}.${apiName} NO existe o el token no lo ve`,
    );
  }

  const idPlantilla = argumento("--plantilla");
  if (idPlantilla) {
    const plantilla = await leerPlantilla(idPlantilla, cfg);
    if (crudo) {
      console.log(JSON.stringify(plantilla.crudo, null, 2));
      return;
    }
    console.log(`\nPlantilla ${plantilla.id} — ${plantilla.nombre}`);
    console.log(`  módulo:  ${plantilla.modulo ?? "?"}`);
    console.log(`  asunto:  ${plantilla.asunto ?? "(sin asunto)"}`);
    console.log(`  cuerpo:  ${plantilla.html.length} caracteres`);
    const combinados = [...plantilla.html.matchAll(CAMPOS_COMBINADOS_RE)].map((m) => m[0]);
    console.log(`  campos combinados: ${[...new Set(combinados)].join("  ") || "ninguno"}`);
    return;
  }

  console.log("\nPlantillas de correo:");
  for (const modulo of MODULOS_DE_PLANTILLA) {
    try {
      const plantillas = await listarPlantillas(modulo, cfg);
      console.log(`  ${modulo}: ${plantillas.length}`);
      for (const p of plantillas) {
        console.log(`    ${p.id}  ${p.nombre}${p.carpeta ? `  [${p.carpeta}]` : ""}`);
      }
      if (crudo && plantillas[0]) console.log(JSON.stringify(plantillas[0].crudo, null, 2));
    } catch (err) {
      console.log(`  ${modulo}: ERROR ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
