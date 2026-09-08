/**
 * Aplica la migración 038 — tablas del maestro corporativo, sus RPC de
 * reemplazo, la zona nueva del portal y la columna `fuente` de upload_logs.
 *
 * Aditiva: no borra ninguna fila ni ninguna tabla. Lo único que toca de lo
 * existente son los `sort_order` de app_zone (para colocar «Corporativas» en
 * segunda posición) y una columna nueva en upload_logs. Idempotente.
 *
 * La verificación no se conforma con leer el catálogo: comprueba que los CHECK
 * RECHAZAN de verdad los valores fuera de vocabulario (insertando y deshaciendo
 * dentro de un savepoint), que las tres tablas quedan sin política de SELECT
 * —son la cuenta de resultados del grupo y solo las lee el service role— y que
 * las cinco zonas quedan ordenadas sin huecos ni empates.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run corporativo:apply-migration-038
 *   npm run corporativo:apply-migration-038 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "../pm/lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260908120000_038_corporativo.sql",
);

const TABLAS = ["corp_periodos", "corp_diccionario", "corp_notas"];
const RPCS = ["replace_corp_periodos", "replace_corp_diccionario", "replace_corp_notas"];
const COLUMNAS_CORP_PERIODOS = 46;

/** Orden de zonas que tiene que quedar, alineado con ZONE_ORDER del registry. */
const ZONAS_ESPERADAS: [string, number][] = [
  ["financiero", 1],
  ["corporativo", 2],
  ["pm", 3],
  ["adquisiciones", 4],
  ["data", 5],
];

interface Zona {
  key: string;
  label: string;
  sort_order: number;
}

async function zonas(client: PoolClient): Promise<Zona[]> {
  const { rows } = await client.query<Zona>(
    "SELECT key, label, sort_order FROM app_zone ORDER BY sort_order, key",
  );
  return rows;
}

async function existeTabla(client: PoolClient, tabla: string): Promise<boolean> {
  const { rows } = await client.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename = $1",
    [tabla],
  );
  return (rows[0]?.n ?? 0) > 0;
}

async function rlsActiva(client: PoolClient, tabla: string): Promise<boolean> {
  const { rows } = await client.query<{ relrowsecurity: boolean }>(
    "SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || $1)::regclass",
    [tabla],
  );
  return rows[0]?.relrowsecurity ?? false;
}

async function politicas(client: PoolClient, tabla: string): Promise<string[]> {
  const { rows } = await client.query<{ policyname: string }>(
    "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
    [tabla],
  );
  return rows.map((r) => r.policyname);
}

async function existeFuncion(client: PoolClient, nombre: string): Promise<boolean> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1`,
    [nombre],
  );
  return (rows[0]?.n ?? 0) > 0;
}

async function numColumnas(client: PoolClient, tabla: string): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tabla],
  );
  return rows[0]?.n ?? 0;
}

async function tieneColumna(client: PoolClient, tabla: string, columna: string): Promise<boolean> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [tabla, columna],
  );
  return (rows[0]?.n ?? 0) > 0;
}

/**
 * ¿Deja pasar `corp_periodos` esta combinación? Se prueba insertando de verdad
 * dentro de un savepoint que siempre se deshace: leer la definición del CHECK
 * dice cómo está escrito, no qué acaba aceptando.
 */
async function aceptaFila(
  client: PoolClient,
  sociedad: string,
  tipoPeriodo: string,
  naturaleza: string,
): Promise<boolean> {
  await client.query("SAVEPOINT probar_fila");
  try {
    await client.query(
      `INSERT INTO corp_periodos (id, sociedad, periodo, tipo_periodo, naturaleza)
       VALUES ($1, $2, 'SONDA', $3, $4)`,
      [`__probe_${sociedad}_${tipoPeriodo}_${naturaleza}__`, sociedad, tipoPeriodo, naturaleza],
    );
    return true;
  } catch {
    return false;
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT probar_fila");
    await client.query("RELEASE SAVEPOINT probar_fila");
  }
}

function pintarZonas(filas: Zona[]): void {
  for (const z of filas) {
    const marca = z.key === "corporativo" ? "→" : " ";
    console.log(`  ${marca} ${String(z.sort_order).padStart(2)}  ${z.key.padEnd(15)}${z.label}`);
  }
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    // Todo en una transacción: las sondas insertan y deshacen, así que ni el
    // dry-run ni una verificación a medias pueden dejar rastro.
    await client.query("BEGIN");
    try {
      console.log("— antes —");
      for (const t of TABLAS) {
        console.log(`  ${t.padEnd(18)}${(await existeTabla(client, t)) ? "existe" : "no existe"}`);
      }
      console.log(
        `  upload_logs.fuente ${(await tieneColumna(client, "upload_logs", "fuente")) ? "existe" : "no existe"}`,
      );
      console.log("\n  zonas:");
      pintarZonas(await zonas(client));

      if (!apply) {
        console.log("\nDry-run. Repite con --apply para escribir.");
        await client.query("ROLLBACK");
        return;
      }

      console.log("\naplicando migración 038…");
      await client.query(sql);

      const problemas: string[] = [];

      // 1. Las tres tablas, con RLS y SIN política de SELECT: solo service role.
      for (const t of TABLAS) {
        if (!(await existeTabla(client, t))) {
          problemas.push(`la tabla ${t} no existe`);
          continue;
        }
        if (!(await rlsActiva(client, t))) problemas.push(`${t} no tiene RLS habilitada`);
        const pols = await politicas(client, t);
        if (pols.length > 0) {
          problemas.push(
            `${t} tiene política(s) (${pols.join(", ")}): debería quedar solo para service_role`,
          );
        }
      }

      // 2. corp_periodos con sus 46 columnas: si falta alguna, el RPC fallaría
      //    en la primera carga y no aquí, que es donde se puede ver.
      const cols = await numColumnas(client, "corp_periodos");
      if (cols !== COLUMNAS_CORP_PERIODOS) {
        problemas.push(`corp_periodos tiene ${cols} columnas y debería tener ${COLUMNAS_CORP_PERIODOS}`);
      }

      // 3. Las tres RPC de reemplazo.
      for (const fn of RPCS) {
        if (!(await existeFuncion(client, fn))) problemas.push(`falta la función ${fn}`);
      }

      // 4. Los CHECK aceptan el vocabulario del maestro y rechazan lo demás.
      const validas: [string, string, string][] = [
        ["GIIC", "TRIMESTRE", "REAL"],
        ["ICI+ICAM", "AÑO", "MIXTO"],
        ["GRUPO", "ACUMULADO", "PREVISIÓN"],
      ];
      for (const [s, t, n] of validas) {
        if (!(await aceptaFila(client, s, t, n))) {
          problemas.push(`el CHECK rechaza la combinación válida ${s} / ${t} / ${n}`);
        }
      }
      const invalidas: [string, string, string][] = [
        ["ICAM", "TRIMESTRE", "REAL"], // sociedad que no existe como tal
        ["GRUPO", "MENSUAL", "REAL"], // el maestro no publica meses
        ["GRUPO", "TRIMESTRE", "ESTIMADO"], // naturaleza inventada
      ];
      for (const [s, t, n] of invalidas) {
        if (await aceptaFila(client, s, t, n)) {
          problemas.push(`el CHECK acepta ${s} / ${t} / ${n}: se ha quedado abierto`);
        }
      }

      // 5. upload_logs distingue de qué sincronización viene cada línea.
      if (!(await tieneColumna(client, "upload_logs", "fuente"))) {
        problemas.push("upload_logs no tiene la columna fuente");
      }

      // 6. Las cinco zonas, en orden y sin empates.
      const zonasDespues = await zonas(client);
      console.log("\n— después —");
      console.log("  zonas:");
      pintarZonas(zonasDespues);
      for (const [key, orden] of ZONAS_ESPERADAS) {
        const z = zonasDespues.find((x) => x.key === key);
        if (!z) {
          problemas.push(`falta la zona ${key}`);
        } else if (z.sort_order !== orden) {
          problemas.push(`la zona ${key} está en ${z.sort_order} y debería estar en ${orden}`);
        }
      }
      const ordenes = zonasDespues.map((z) => z.sort_order);
      if (new Set(ordenes).size !== ordenes.length) {
        problemas.push("hay zonas con el mismo sort_order: la nav quedaría en orden arbitrario");
      }

      console.log(`\n  tablas: ${TABLAS.join(", ")}`);
      console.log(`  columnas de corp_periodos: ${cols}`);
      console.log(`  funciones: ${RPCS.join(", ")}`);

      if (problemas.length > 0) {
        console.error(`\n${problemas.length} problema(s):`);
        problemas.forEach((p) => console.error(`  - ${p}`));
        console.error("\nSe deshace la migración.");
        await client.query("ROLLBACK");
        process.exitCode = 1;
        return;
      }

      await client.query("COMMIT");
      console.log("\nMigración 038 aplicada y verificada.");
      console.log("Siguiente paso: conceder el rol de la zona con `npm run auth:grant`,");
      console.log("y cargar los datos con `npm run corporativo:sync-maestro`.");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
}

main()
  .catch((e) => {
    console.error("\nError:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => closePgPool());
