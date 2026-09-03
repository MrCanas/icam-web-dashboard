/**
 * Aplica la migración 037 — usos TERCIARIO y FONDO, LSE84 pasa a terciario y
 * alta de SICCII y VBARE.
 *
 * Cierra el catálogo de PM contra el de Actas: eran los dos últimos proyectos
 * con actas propias que no existían en pm_activos. Y corrige el uso de LSE84,
 * que la 036 dejó en RESIDENCIAL_LIBRE por no tener mejor dato.
 *
 * Aditiva e idempotente: el CHECK se recrea con un dominio más amplio, los
 * INSERT llevan ON CONFLICT DO NOTHING y los UPDATE solo tocan lo que no está
 * en su sitio. No borra nada.
 *
 * La verificación comprueba que el CHECK admite los cuatro usos y SIGUE
 * rechazando uno inventado, que los tres activos quedan como deben, que el
 * vínculo con Actas resuelve, y que no ha cambiado ningún otro activo.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-037
 *   npm run pm:apply-migration-037 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260903140000_037_usos_terciario_fondo_siccii_vbare.sql",
);

const USOS_ESPERADOS = ["APT", "RESIDENCIAL_LIBRE", "TERCIARIO", "FONDO"];

/** id_activo → uso que debe tener al terminar. */
const USO_FINAL: Record<string, string> = {
  LSE84: "TERCIARIO",
  SICCII: "FONDO",
  VBARE: "FONDO",
};

/** project.code (Actas) → id_activo (PM). «SICC II» no casa por igualdad. */
const VINCULOS: Record<string, string> = {
  "SICC II": "SICCII",
  VBARE: "VBARE",
};

interface ActivoFila {
  id: string;
  id_activo: string;
  tipo_uso_activo: string;
  nombre_display: string | null;
  orden: number;
  archivado_at: string | null;
  hitos: number;
}

async function activos(client: PoolClient): Promise<ActivoFila[]> {
  const { rows } = await client.query<ActivoFila>(
    `SELECT a.id, a.id_activo, a.tipo_uso_activo, a.nombre_display, a.orden,
            a.archivado_at,
            (SELECT count(*)::int FROM pm_hitos h WHERE h.activo_id = a.id) AS hitos
       FROM pm_activos a
      ORDER BY a.orden, a.id_activo`,
  );
  return rows;
}

async function definicionCheck(client: PoolClient): Promise<string> {
  const { rows } = await client.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conrelid = 'public.pm_activos'::regclass
        AND conname = 'pm_activos_tipo_uso_activo_check'`,
  );
  return rows[0]?.def ?? "(sin CHECK)";
}

interface ProyectoActas {
  code: string;
  pm_activo_id: string | null;
  activo_vinculado: string | null;
}

async function proyectosActas(client: PoolClient): Promise<ProyectoActas[]> {
  const { rows } = await client.query<ProyectoActas>(
    `SELECT p.code, p.pm_activo_id, a.id_activo AS activo_vinculado
       FROM project p
       LEFT JOIN pm_activos a ON a.id = p.pm_activo_id
      ORDER BY p.sort_order`,
  );
  return rows;
}

/**
 * ¿Acepta el CHECK este uso? Se prueba de verdad contra la base, dentro de un
 * savepoint que siempre se deshace: leer la definición del constraint dice cómo
 * está escrito, no qué deja pasar.
 */
async function aceptaUso(client: PoolClient, uso: string): Promise<boolean> {
  await client.query("SAVEPOINT probar_uso");
  try {
    await client.query(
      "INSERT INTO pm_activos (id_activo, tipo_uso_activo) VALUES ($1, $2)",
      [`__probe_${uso}__`, uso],
    );
    return true;
  } catch {
    return false;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT probar_uso");
    await client.query("RELEASE SAVEPOINT probar_uso");
  }
}

function pintarActivos(filas: ActivoFila[]): void {
  for (const a of filas) {
    const marca = a.id_activo in USO_FINAL ? "→" : " ";
    console.log(
      `  ${marca} ${String(a.orden).padStart(2)} ${a.id_activo.padEnd(22)}` +
        `${a.tipo_uso_activo.padEnd(19)}${String(a.hitos).padStart(3)} hito(s)  ` +
        `${a.nombre_display ?? "—"}`,
    );
  }
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    // Todo en una transacción: la sonda de usos inserta y deshace, y así ni el
    // dry-run ni una verificación a medias pueden dejar rastro.
    await client.query("BEGIN");
    try {
      const antes = await activos(client);
      const antesActas = await proyectosActas(client);

      console.log(`— antes —  ${antes.length} activo(s) en pm_activos`);
      pintarActivos(antes);
      console.log(`\n  CHECK: ${await definicionCheck(client)}`);
      for (const [code, idActivo] of Object.entries(VINCULOS)) {
        const p = antesActas.find((x) => x.code === code);
        console.log(
          p
            ? `  actas «${code}» → ${p.pm_activo_id ? p.activo_vinculado : "sin vincular"} (esperado ${idActivo})`
            : `  actas «${code}»: NO existe el proyecto de Actas`,
        );
      }

      if (!apply) {
        console.log("\nDry-run. Repite con --apply para escribir.");
        await client.query("ROLLBACK");
        return;
      }

      console.log("\naplicando migración 037…");
      await client.query(sql);

      const despues = await activos(client);
      const despuesActas = await proyectosActas(client);

      console.log(`\n— después —  ${despues.length} activo(s) en pm_activos`);
      pintarActivos(despues);
      console.log(`\n  CHECK: ${await definicionCheck(client)}`);

      const problemas: string[] = [];

      // 1. El CHECK admite los cuatro usos y sigue rechazando lo inventado.
      for (const uso of USOS_ESPERADOS) {
        if (!(await aceptaUso(client, uso))) problemas.push(`el CHECK rechaza «${uso}»`);
      }
      if (await aceptaUso(client, "HOTEL")) {
        problemas.push("el CHECK acepta «HOTEL»: se ha quedado abierto");
      }

      // 2. Los tres activos, con su uso definitivo y sin hitos los nuevos.
      for (const [idActivo, uso] of Object.entries(USO_FINAL)) {
        const a = despues.find((x) => x.id_activo === idActivo);
        if (!a) {
          problemas.push(`${idActivo} no está en pm_activos`);
          continue;
        }
        if (a.tipo_uso_activo !== uso) {
          problemas.push(`${idActivo} es ${a.tipo_uso_activo} y debería ser ${uso}`);
        }
        if (a.archivado_at) problemas.push(`${idActivo} está archivado`);
        const previo = antes.find((x) => x.id_activo === idActivo);
        if (!previo && a.hitos !== 0) {
          problemas.push(`${idActivo} tiene ${a.hitos} hito(s); debería nacer vacío`);
        }
      }

      // 3. El vínculo con Actas resuelve al activo correcto.
      for (const [code, idActivo] of Object.entries(VINCULOS)) {
        const p = despuesActas.find((x) => x.code === code);
        if (!p) {
          problemas.push(`no existe el proyecto de Actas «${code}» que vincular`);
          continue;
        }
        if (p.activo_vinculado !== idActivo) {
          problemas.push(
            `actas «${code}» apunta a ${p.activo_vinculado ?? "nada"} en vez de a ${idActivo}`,
          );
        }
      }

      // 4. Nada más ha cambiado. LSE84 sí cambia de uso: es el único permitido.
      for (const a of antes) {
        const d = despues.find((x) => x.id === a.id);
        if (!d) {
          problemas.push(`ha desaparecido el activo ${a.id_activo}`);
          continue;
        }
        const usoEsperado = USO_FINAL[a.id_activo] ?? a.tipo_uso_activo;
        if (
          d.id_activo !== a.id_activo ||
          d.tipo_uso_activo !== usoEsperado ||
          d.nombre_display !== a.nombre_display ||
          d.orden !== a.orden ||
          d.archivado_at !== a.archivado_at ||
          d.hitos !== a.hitos
        ) {
          problemas.push(`el activo ${a.id_activo} ha cambiado y no debía`);
        }
      }
      for (const p of antesActas) {
        if (p.code in VINCULOS) continue;
        const d = despuesActas.find((x) => x.code === p.code);
        if (d?.pm_activo_id !== p.pm_activo_id) {
          problemas.push(`el vínculo de actas «${p.code}» ha cambiado y no debía`);
        }
      }

      console.log("");
      if (problemas.length === 0) {
        console.log(
          "✓ Migración 037 OK. LSE84 es TERCIARIO, SICCII y VBARE están de alta como " +
            "FONDO y vinculados a su acta, y no se ha tocado nada más.\n" +
            "  El catálogo de PM ya cubre todos los proyectos de Actas. Queda para la " +
            "PMO: mapearlos al maestro financiero y a su promoción de Zoho.",
        );
        await client.query("COMMIT");
      } else {
        for (const p of problemas) console.log(`✗ ${p}`);
        console.log("\nRevirtiendo: la verificación ha fallado, no se confirma nada.");
        await client.query("ROLLBACK");
        process.exitCode = 1;
      }
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
