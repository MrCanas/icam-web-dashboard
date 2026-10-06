/**
 * Inventario de lo que usan las plantillas de correo del CRM. Solo LEE.
 *
 * Desde que el portal monta el correo (para poder rastrear aperturas y clics),
 * los campos combinados los resuelve él y no Zoho. Este script dice qué campos
 * usan de verdad las plantillas y de qué tipo son, que es lo que hay que saber
 * antes de fiarse de `renderizarPlantilla`: un importe o una fecha no se
 * escriben igual que un nombre.
 *
 *   npm run comunicaciones:plantillas-campos
 *   npm run comunicaciones:plantillas-campos -- --detalle   # qué plantillas usan cada campo
 *
 * Avisa también de lo que el portal no reproduce: campos de otro módulo,
 * expresiones que no son `${!Módulo.Campo}`, y adjuntos.
 */
import { cargarEnv } from "../pm/lib/env";
import { getZohoConfig, listarCampos, zohoVariablesQueFaltan } from "@/lib/zoho/client";
import {
  CAMPOS_COMBINADOS_RE,
  leerPlantilla,
  listarPlantillas,
  MODULOS_DE_PLANTILLA,
} from "@/modules/comunicaciones/data/zohoPlantillas";

const CAMPO_DE_MODULO_RE = /^\$\{!?([^.}\s]+)\.([^}]+)\}$/;

interface Uso {
  plantillas: Set<string>;
  tipo: string;
}

async function main(): Promise<void> {
  cargarEnv();
  const faltan = zohoVariablesQueFaltan({ conModulo: false });
  if (faltan.length > 0) throw new Error(`Faltan variables de entorno: ${faltan.join(", ")}`);
  const cfg = getZohoConfig({ conModulo: false });
  const detalle = process.argv.includes("--detalle");

  for (const modulo of MODULOS_DE_PLANTILLA) {
    const campos = new Map((await listarCampos(modulo, cfg)).map((c) => [c.api_name, c]));
    const resumenes = await listarPlantillas(modulo, cfg);
    const usos = new Map<string, Uso>();
    const raros = new Map<string, Set<string>>();
    let sinImagen = 0;
    let conAdjuntos = 0;
    let enlaces = 0;
    let sinEnlaces = 0;
    let fallidas = 0;

    for (const resumen of resumenes) {
      let plantilla;
      try {
        // En serie: Zoho limita las llamadas a /settings por minuto.
        plantilla = await leerPlantilla(resumen.id, cfg);
      } catch {
        fallidas++;
        continue;
      }
      const texto = `${plantilla.asunto ?? ""}\n${plantilla.html}`;
      for (const expresion of new Set(texto.match(CAMPOS_COMBINADOS_RE) ?? [])) {
        const m = CAMPO_DE_MODULO_RE.exec(expresion);
        if (!m || m[1] !== modulo) {
          const grupo = raros.get(expresion) ?? new Set<string>();
          grupo.add(plantilla.nombre);
          raros.set(expresion, grupo);
          continue;
        }
        const apiName = m[2]!.trim();
        const uso = usos.get(apiName) ?? {
          plantillas: new Set<string>(),
          tipo: campos.get(apiName)?.data_type ?? "NO EXISTE EN EL MÓDULO",
        };
        uso.plantillas.add(plantilla.nombre);
        usos.set(apiName, uso);
      }
      if (!/<img\b/i.test(plantilla.html)) sinImagen++;
      const nEnlaces = (plantilla.html.match(/<a\b[^>]*\bhref\s*=\s*["']https?:/gi) ?? []).length;
      enlaces += nEnlaces;
      if (nEnlaces === 0) sinEnlaces++;
      const adjuntos = plantilla.crudo.attachments;
      if (Array.isArray(adjuntos) && adjuntos.length > 0) conAdjuntos++;
    }

    console.log(`\n=== ${modulo}: ${resumenes.length} plantillas${fallidas ? ` (${fallidas} no se pudieron leer)` : ""} ===`);
    console.log(`  sin ninguna imagen: ${sinImagen} · sin ningún enlace: ${sinEnlaces} · enlaces en total: ${enlaces} · con adjuntos: ${conAdjuntos}`);

    console.log("  Campos combinados del módulo:");
    const ordenados = [...usos.entries()].sort((a, b) => b[1].plantillas.size - a[1].plantillas.size);
    if (ordenados.length === 0) console.log("    (ninguno)");
    for (const [apiName, uso] of ordenados) {
      console.log(`    ${apiName}  ·  ${uso.tipo}  ·  ${uso.plantillas.size} plantillas`);
      if (detalle) for (const p of uso.plantillas) console.log(`        - ${p}`);
    }

    console.log("  Expresiones que NO son un campo de este módulo (el portal no las resuelve):");
    if (raros.size === 0) console.log("    (ninguna)");
    for (const [expresion, plantillas] of [...raros.entries()].sort((a, b) => b[1].size - a[1].size)) {
      console.log(`    ${expresion}  ·  ${plantillas.size} plantillas`);
      if (detalle) for (const p of plantillas) console.log(`        - ${p}`);
    }
  }
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
