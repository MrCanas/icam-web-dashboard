/**
 * Importa al portal los informes trimestrales hechos antes de pm/informes: los
 * del artifact de claude.ai y los del skill. Así el primer informe que se haga
 * en el portal encuentra el del trimestre anterior como «informe anterior»
 * estructurado y no hay que volver a subirlo en PDF.
 *
 * El paquete lo genera `python app-equipo/exportar_para_portal.py` en el repo
 * del motor de informes (ImparOS-InformesTrimestrales/migracion-portal/paquete):
 *   proyectos/ informes/ fuentes/ versiones/   un documento JSON por fichero
 *   assets/<id>.<ext>                          fotos referenciadas como /_blob/<id>
 * Es confidencial: no se commitea, se pasa por ruta.
 *
 * Qué hace:
 *   1. Comprueba que la migración 043 está aplicada.
 *   2. Vincula cada proyecto con su activo PM (código exacto o normalizado y
 *      único; si es ambiguo lo deja sin vincular y lo dice).
 *   3. Sube a Storage las fotos de los informes que se van a importar y
 *      reescribe /_blob/<id> → /api/informes/assets/<id nuevo>.
 *   4. Inserta los documentos. Los que ya existen se saltan salvo con
 *      --sobrescribir.
 *
 * Dry-run por defecto: no escribe nada, solo cuenta.
 *
 *   npm run pm:importar-informes -- --origen "<ruta al paquete>"
 *   npm run pm:importar-informes -- --origen "<ruta al paquete>" --apply
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { COLECCIONES } from "../../src/modules/pm/informes/logic/colecciones";
import {
  emparejarActivo,
  idsDeFotos,
  reescribirFotos,
} from "../../src/modules/pm/informes/logic/importacion";
import type { ColeccionInforme, DocumentoApp } from "../../src/modules/pm/informes/types";
import { cargarEnv } from "./lib/env";

const ORDEN: ColeccionInforme[] = ["proyectos", "informes", "fuentes", "versiones"];
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const BUCKET = "informes-fotos";

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function leerColeccion(origen: string, c: ColeccionInforme): Map<string, DocumentoApp> {
  const carpeta = join(origen, c);
  const docs = new Map<string, DocumentoApp>();
  if (!existsSync(carpeta)) return docs;
  for (const f of readdirSync(carpeta).filter((x) => x.endsWith(".json")).sort()) {
    docs.set(f.slice(0, -5), JSON.parse(readFileSync(join(carpeta, f), "utf8")) as DocumentoApp);
  }
  return docs;
}

async function main(): Promise<void> {
  cargarEnv();
  const origenArg = argumento("--origen");
  if (!origenArg) throw new Error("Falta --origen <carpeta del paquete>");
  const origen = resolve(origenArg);
  const aplicar = process.argv.includes("--apply");
  const sobrescribir = process.argv.includes("--sobrescribir");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(aplicar ? "IMPORTANDO informes.\n" : "Simulación: no se escribe nada. Añade --apply para importar.\n");

  // 1. Migración 043.
  const { error: sinTablas } = await supabase.from("informe").select("id").limit(1);
  if (sinTablas) {
    throw new Error(`No se puede leer la tabla informe (${sinTablas.message}). Aplica antes: npm run pm:apply-migration-043 -- --apply`);
  }

  const docs = Object.fromEntries(ORDEN.map((c) => [c, leerColeccion(origen, c)])) as Record<
    ColeccionInforme,
    Map<string, DocumentoApp>
  >;

  // 2. Vínculo proyecto ↔ activo PM.
  const { data: activosRaw, error: errActivos } = await supabase.from("pm_activos").select("id_activo");
  if (errActivos) throw new Error(errActivos.message);
  const activos = (activosRaw ?? []).map((a) => a.id_activo as string);
  const activoDe = new Map<string, string | null>();
  for (const [codigo, p] of docs.proyectos) {
    const actual = typeof p.idActivo === "string" ? p.idActivo : null;
    const activo = actual && activos.includes(actual) ? actual : emparejarActivo(codigo, activos);
    activoDe.set(codigo, activo);
    if (activo) p.idActivo = activo;
    console.log(`  proyecto ${codigo} → ${activo ? `activo PM ${activo}` : "SIN activo PM (vincúlalo desde la app: no tendrá fuentes automáticas)"}`);
  }
  for (const inf of docs.informes.values()) {
    const activo = activoDe.get(String(inf.codigo));
    if (activo && !inf.idActivo) inf.idActivo = activo;
  }

  // 3. Qué existe ya.
  const importar = new Map<ColeccionInforme, string[]>();
  for (const c of ORDEN) {
    const def = COLECCIONES[c];
    const ids = [...docs[c].keys()];
    const { data, error } = ids.length
      ? await supabase.from(def.tabla).select(def.clave).in(def.clave, ids)
      : { data: [], error: null };
    if (error) throw new Error(error.message);
    const existen = new Set((data ?? []).map((r) => String((r as unknown as Record<string, unknown>)[def.clave])));
    const nuevos = ids.filter((id) => sobrescribir || !existen.has(id));
    importar.set(c, nuevos);
    const saltados = ids.filter((id) => !nuevos.includes(id));
    console.log(
      `  ${c}: ${nuevos.length} a importar${saltados.length ? `, ${saltados.length} ya existen (${saltados.join(", ")})` : ""}`,
    );
  }

  // Fotos de los documentos que se importan.
  const fotos = new Set<string>();
  for (const c of ORDEN) for (const id of importar.get(c)!) for (const f of idsDeFotos(docs[c].get(id))) fotos.add(f);
  const ficheros = existsSync(join(origen, "assets")) ? readdirSync(join(origen, "assets")) : [];
  const ficheroDe = new Map(ficheros.map((f) => [f.slice(0, -extname(f).length), f]));
  const faltan = [...fotos].filter((f) => !ficheroDe.has(f));
  console.log(`  fotos: ${fotos.size} referenciadas${faltan.length ? `, FALTAN ${faltan.length}: ${faltan.join(", ")}` : ""}`);

  if (!aplicar) {
    console.log("\nDry-run. Repite con --apply para importar.");
    return;
  }

  // 4. Subir fotos.
  const nuevos: Record<string, string> = {};
  for (const f of fotos) {
    const fichero = ficheroDe.get(f);
    if (!fichero) continue;
    const mime = MIME[extname(fichero).toLowerCase()];
    if (!mime) {
      console.log(`  ✗ ${fichero}: formato no admitido`);
      continue;
    }
    const id = randomUUID();
    const ruta = `${id.slice(0, 2)}/${id}${extname(fichero).toLowerCase()}`;
    const cuerpo = readFileSync(join(origen, "assets", fichero));
    const { error: errSubida } = await supabase.storage.from(BUCKET).upload(ruta, cuerpo, { contentType: mime });
    if (errSubida) throw new Error(`${fichero}: ${errSubida.message}`);
    const { error } = await supabase
      .from("informe_asset")
      .insert({ id, storage_path: ruta, mime_type: mime, size_bytes: cuerpo.byteLength });
    if (error) throw new Error(`${fichero}: ${error.message}`);
    nuevos[f] = id;
  }
  console.log(`  ✓ ${Object.keys(nuevos).length} fotos subidas`);

  // 5. Documentos.
  const ahora = new Date().toISOString();
  for (const c of ORDEN) {
    const def = COLECCIONES[c];
    for (const id of importar.get(c)!) {
      const { doc, sinResolver } = reescribirFotos(docs[c].get(id)!, nuevos);
      if (sinResolver.length) console.log(`  ! ${c}/${id}: fotos sin resolver ${sinResolver.join(", ")}`);
      const fila: Record<string, unknown> = { [def.clave]: id, ...def.columnas(doc), datos: doc };
      if (c !== "versiones") fila.updated_at = ahora;
      const { error } = await supabase.from(def.tabla).upsert(fila, { onConflict: def.clave });
      if (error) throw new Error(`${c}/${id}: ${error.message}`);
      console.log(`  ✓ ${c}/${id}`);
    }
  }
  console.log("\n✓ Importación terminada.");
}

// Ver la nota de scripts/inversores/zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
