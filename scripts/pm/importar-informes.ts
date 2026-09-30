/**
 * Importa al portal los informes trimestrales hechos antes del módulo
 * pm/informes: los del artifact de claude.ai y los del skill. Así el primer
 * informe que se haga en el portal encuentra el del trimestre anterior como
 * «informe anterior» estructurado.
 *
 * Origen: el paquete que genera `python app-equipo/exportar_para_portal.py` en
 * ImparOS-InformesTrimestrales (migracion-portal/paquete). Reúne el export del
 * artifact y los informe.json del skill con sus fotos:
 *   proyectos/ informes/ fuentes/ versiones/   un documento JSON por fichero
 *   assets/<id>.<ext>                          fotos referenciadas como /_blob/<id>
 * Es confidencial: no se commitea, se lee por ruta.
 *
 * Qué hace:
 *   1. Comprueba que la migración 043 está aplicada.
 *   2. Crea o actualiza cada proyecto (informe_proyecto) y lo vincula con su
 *      activo PM si el código casa (exacto o normalizado y único). Los que no
 *      casan (PC25, SA31-33) quedan sin vincular: se vinculan en el paso 0.
 *   3. Sube las fotos de cada informe a Storage (informe_foto) y reescribe
 *      /_blob/<id> → /api/informes/fotos/<id nuevo>.
 *   4. Inserta informes, fuentes, historial y versiones. Un informe que ya
 *      existe se salta, salvo con --sobrescribir (lo borra y lo vuelve a crear).
 * No borra nada del origen.
 *
 * Simulación por defecto: no escribe nada, solo cuenta.
 *
 *   npm run pm:importar-informes
 *   npm run pm:importar-informes -- --apply
 *   npm run pm:importar-informes -- --origen "<ruta al paquete>" --apply [--sobrescribir]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  categoriaFoto,
  emparejarActivo,
  filaInforme,
  fuentesDe,
  idsDeFotos,
  reescribirFotos,
} from "../../src/modules/pm/informes/logic/importacion";
import { cargarEnv } from "./lib/env";

const ORIG = resolve(process.env.USERPROFILE ?? "", "OneDrive - Impar Capital/Documentos/ImparOS-InformesTrimestrales");
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const BUCKET = "informes-fotos";

type Doc = Record<string, unknown>;

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function leerColeccion(origen: string, c: string): Map<string, Doc> {
  const carpeta = join(origen, c);
  const docs = new Map<string, Doc>();
  if (!existsSync(carpeta)) return docs;
  for (const f of readdirSync(carpeta).filter((x) => x.endsWith(".json")).sort()) {
    docs.set(f.slice(0, -5), JSON.parse(readFileSync(join(carpeta, f), "utf8")) as Doc);
  }
  return docs;
}

async function main(): Promise<void> {
  cargarEnv();
  const origen = resolve(argumento("--origen") ?? join(ORIG, "migracion-portal/paquete"));
  const aplicar = process.argv.includes("--apply");
  const sobrescribir = process.argv.includes("--sobrescribir");
  if (!existsSync(origen)) throw new Error(`No existe el paquete ${origen}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log(aplicar ? "IMPORTANDO informes.\n" : "Simulación: no se escribe nada. Añade --apply para importar.\n");
  console.log(`Origen: ${origen}\n`);

  // 1. Migración 043.
  const { error: sinTablas } = await sb.from("informe").select("id").limit(1);
  if (sinTablas) throw new Error(`No se puede leer la tabla informe (${sinTablas.message}). Aplica antes: npm run pm:apply-migration-043 -- --apply`);

  const proyectos = leerColeccion(origen, "proyectos");
  const informes = leerColeccion(origen, "informes");
  const fuentes = leerColeccion(origen, "fuentes");
  const versiones = leerColeccion(origen, "versiones");
  const assets = new Map<string, string>();
  if (existsSync(join(origen, "assets"))) {
    for (const f of readdirSync(join(origen, "assets"))) assets.set(f.replace(/\.[^.]+$/, ""), join(origen, "assets", f));
  }
  console.log(`Paquete: ${proyectos.size} proyectos, ${informes.size} informes, ${fuentes.size} fuentes, ${versiones.size} versiones, ${assets.size} fotos.\n`);

  // 2. Proyectos y vínculo con pm_activos.
  const { data: activosRows, error: eAct } = await sb.from("pm_activos").select("id_activo");
  if (eAct) throw new Error(eAct.message);
  const activos = (activosRows ?? []).map((a) => a.id_activo as string);
  const { data: yaProy } = await sb.from("informe_proyecto").select("codigo, id_activo");
  const vinculados = new Map((yaProy ?? []).filter((p) => p.id_activo).map((p) => [p.id_activo as string, p.codigo as string]));
  const codigosProyecto = new Set<string>();
  for (const [codigo, p] of proyectos) {
    const previo = (yaProy ?? []).find((x) => x.codigo === codigo);
    let idActivo = (previo?.id_activo as string | null) ?? emparejarActivo(codigo, activos);
    if (idActivo && vinculados.has(idActivo) && vinculados.get(idActivo) !== codigo) {
      console.log(`  ! ${codigo}: el activo ${idActivo} ya está vinculado a ${vinculados.get(idActivo)}; se deja sin vincular.`);
      idActivo = null;
    }
    console.log(`  proyecto ${codigo} (${String(p.nombre)}) → ${idActivo ? `activo ${idActivo}` : "SIN VINCULAR (se vincula en el paso 0)"}${previo ? " · ya existía" : ""}`);
    codigosProyecto.add(codigo);
    if (aplicar) {
      const { error } = await sb.from("informe_proyecto").upsert(
        {
          codigo,
          nombre: String(p.nombre || codigo),
          id_activo: idActivo,
          arquetipo: ["A", "B", "C", "D", "E"].includes(String(p.arquetipo)) ? String(p.arquetipo) : "A",
          pie: (p.pie as object | undefined) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "codigo" },
      );
      if (error) throw new Error(`proyecto ${codigo}: ${error.message}`);
    }
  }

  // 3–4. Informes con sus fotos, fuentes, historial y versiones.
  let importados = 0;
  let saltados = 0;
  for (const [id, doc] of informes) {
    const codigo = String(doc.codigo);
    if (!codigosProyecto.has(codigo)) {
      console.log(`  ✗ ${id}: su proyecto ${codigo} no está en el paquete; se salta.`);
      saltados++;
      continue;
    }
    const { data: ya } = await sb.from("informe").select("id").eq("id", id).maybeSingle();
    if (ya && !sobrescribir) {
      console.log(`  = ${id}: ya existe; se salta (usa --sobrescribir para reemplazarlo).`);
      saltados++;
      continue;
    }

    // Fotos: las de la lista del informe más las que citen sus slides.
    const lista = Array.isArray(doc.fotos) ? (doc.fotos as Doc[]) : [];
    const ids = new Set([...lista.map((f) => String(f.id)), ...idsDeFotos(doc)]);
    const nuevos: Record<string, string> = {};
    const filasFoto: Doc[] = [];
    const faltan: string[] = [];
    for (const viejo of ids) {
      const fichero = assets.get(viejo);
      if (!fichero) {
        faltan.push(viejo);
        continue;
      }
      const nuevo = randomUUID();
      nuevos[viejo] = nuevo;
      const meta = lista.find((f) => String(f.id) === viejo) ?? {};
      const ext = extname(fichero).toLowerCase();
      const ruta = `${id}/${nuevo}${ext === ".jpeg" ? ".jpg" : ext}`;
      filasFoto.push({
        id: nuevo,
        informe_id: id,
        storage_path: ruta,
        mime: MIME[ext] ?? "image/jpeg",
        ancho: Number(meta.w) || null,
        alto: Number(meta.h) || null,
        categoria: categoriaFoto(meta.categoria),
        para: typeof meta.para === "string" ? meta.para : null,
        pie: typeof meta.pie === "string" && meta.pie ? meta.pie : null,
        nombre: typeof meta.nombre === "string" ? meta.nombre : null,
        __fichero: fichero,
      });
    }
    const { doc: reescrito, sinResolver } = reescribirFotos(doc, nuevos);
    const fila = filaInforme(reescrito);
    const fs = fuentesDe(fuentes.get(id));
    const cambios = Array.isArray(doc.cambios) ? (doc.cambios as Doc[]) : [];
    const vers = [...versiones.values()].filter((v) => v.informeId === id);
    console.log(
      `  + ${id}: ${fila.contenido?.slides.length ?? 0} slides, estado ${fila.estado}, v${fila.version}, ${filasFoto.length} fotos, ${fs.length} fuentes, ${cambios.length} cambios, ${vers.length} versiones` +
        (faltan.length || sinResolver.length ? ` · ${[...new Set([...faltan, ...sinResolver])].length} foto(s) sin fichero` : ""),
    );
    if (!aplicar) {
      importados++;
      continue;
    }

    if (ya) {
      const { data: viejas } = await sb.from("informe_foto").select("storage_path").eq("informe_id", id);
      const { error } = await sb.from("informe").delete().eq("id", id);
      if (error) throw new Error(`${id}: ${error.message}`);
      if (viejas?.length) await sb.storage.from(BUCKET).remove(viejas.map((v) => v.storage_path as string));
    }
    const { error: eInf } = await sb.from("informe").insert(fila);
    if (eInf) throw new Error(`${id}: ${eInf.message}`);
    for (const f of filasFoto) {
      const { __fichero, ...filaFoto } = f;
      const { error: eUp } = await sb.storage
        .from(BUCKET)
        .upload(String(filaFoto.storage_path), readFileSync(String(__fichero)), { contentType: String(filaFoto.mime), upsert: true });
      if (eUp) throw new Error(`${id}: foto ${String(filaFoto.nombre)}: ${eUp.message}`);
      const { error } = await sb.from("informe_foto").insert(filaFoto);
      if (error) throw new Error(`${id}: foto: ${error.message}`);
    }
    if (fs.length) {
      const { error } = await sb.from("informe_fuente").insert(fs.map((x) => ({ ...x, informe_id: id, auto: false, incluida: true })));
      if (error) throw new Error(`${id}: fuentes: ${error.message}`);
    }
    const historial = [
      ...cambios.map((c) => ({ informe_id: id, texto: String(c.texto ?? ""), created_at: typeof c.fecha === "string" ? c.fecha : fila.updated_at })),
      { informe_id: id, texto: "Importado al portal desde el artifact / skill de informes", created_at: new Date().toISOString() },
    ];
    const { error: eCam } = await sb.from("informe_cambio").insert(historial);
    if (eCam) throw new Error(`${id}: historial: ${eCam.message}`);
    for (const v of vers) {
      const { doc: vr } = reescribirFotos(v, nuevos);
      const { error } = await sb.from("informe_version").insert({
        informe_id: id,
        version: Number(vr.version) || 1,
        contenido: vr.informe,
        estado: String(vr.estado ?? "borrador"),
        created_at: typeof vr.fecha === "string" ? vr.fecha : undefined,
      });
      if (error) throw new Error(`${id}: versión: ${error.message}`);
    }
    importados++;
  }

  console.log(
    `\n${aplicar ? "✓ Importados" : "Se importarían"} ${importados} informes; ${saltados} saltados.` +
      (aplicar ? "" : "\nAñade --apply para escribir."),
  );
}

// Ver la nota de scripts/inversores/zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
