/**
 * Aplica las migraciones 024, 025 y 026 — el flujo de validación PM↔maestro.
 *
 * Producción se quedó sin ellas: la Planificación por proyecto avisa de que «la
 * validación contra el maestro financiero está inactiva» porque no existen
 * maestro_lineas_trimestre, maestro_hito_fechas ni pm_snapshot_validacion.
 *
 * Las tres son idempotentes de origen (CREATE TABLE IF NOT EXISTS, CREATE OR
 * REPLACE FUNCTION, políticas dentro de DO $$). Se ejecutan en orden: la 026
 * referencia lo que crea la 024, y la 025 solo reemplaza el cuerpo del RPC.
 *
 * Ojo con la 025: cambia el comportamiento de «añadir trimestre». A partir del
 * corte 2026_Q2 el trimestre nace SIN publicar (siembra la excepción
 * publicado=false); los anteriores se publican solos como siempre. Es el diseño
 * del gate, no un efecto secundario.
 *
 *   npm run pm:apply-migraciones-024-026
 *   npm run pm:apply-migraciones-024-026 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";

interface Migracion {
  nombre: string;
  fichero: string;
  /** Tablas que debe dejar creadas. La 025 no crea ninguna. */
  tablas: string[];
}

const MIGRACIONES: Migracion[] = [
  {
    nombre: "024 maestro_trimestres",
    fichero: "supabase/migrations/20260812100000_024_maestro_trimestres.sql",
    tablas: ["maestro_lineas_trimestre", "maestro_hito_fechas"],
  },
  {
    nombre: "025 publicacion_gate",
    fichero: "supabase/migrations/20260812110000_025_publicacion_gate.sql",
    tablas: [],
  },
  {
    nombre: "026 pm_validacion",
    fichero: "supabase/migrations/20260812120000_026_pm_validacion.sql",
    tablas: ["pm_snapshot_validacion"],
  },
];

/** Tablas cuyo recuento no puede cambiar: las migraciones son aditivas. */
const INTACTAS = [
  "pm_activos",
  "pm_hitos",
  "pm_snapshots",
  "pm_snapshot_fechas",
  "pm_activo_snapshot",
];

async function existeTabla(client: PoolClient, tabla: string): Promise<boolean> {
  const { rows } = await client.query<{ existe: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS existe`,
    [tabla],
  );
  return rows[0]?.existe === true;
}

async function rlsActivo(client: PoolClient, tabla: string): Promise<boolean> {
  const { rows } = await client.query<{ relrowsecurity: boolean }>(
    `SELECT c.relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1`,
    [tabla],
  );
  return rows[0]?.relrowsecurity === true;
}

async function recuentos(client: PoolClient): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of INTACTAS) {
    const { rows } = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.${t}`,
    );
    out[t] = Number(rows[0]?.n ?? "0");
  }
  return out;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  await withPgClient(async (client) => {
    const antes = await recuentos(client);
    console.log("filas antes:", JSON.stringify(antes));

    console.log("\nestado:");
    for (const m of MIGRACIONES) {
      for (const t of m.tablas) {
        console.log(`  ${(await existeTabla(client, t)) ? "OK   " : "FALTA"} ${t}`);
      }
    }

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    for (const m of MIGRACIONES) {
      const sql = readFileSync(resolve(process.cwd(), m.fichero), "utf8");
      console.log(`\naplicando ${m.nombre}…`);
      await client.query(sql);
    }

    console.log("\nverificación:");
    let ok = true;
    for (const m of MIGRACIONES) {
      for (const t of m.tablas) {
        const existe = await existeTabla(client, t);
        const rls = existe && (await rlsActivo(client, t));
        console.log(`  ${existe && rls ? "OK   " : "FALLO"} ${t} (tabla ${existe ? "sí" : "no"}, RLS ${rls ? "sí" : "no"})`);
        if (!existe || !rls) ok = false;
      }
    }

    const { rows: fn } = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM pg_proc p
       JOIN pg_namespace ns ON ns.oid = p.pronamespace
       WHERE ns.nspname = 'public' AND p.proname = 'anadir_pm_snapshot'`,
    );
    const unaSola = fn[0]?.n === "1";
    console.log(`  ${unaSola ? "OK   " : "FALLO"} anadir_pm_snapshot: ${fn[0]?.n} versión(es) — debe ser 1, no un overload`);
    if (!unaSola) ok = false;

    const despues = await recuentos(client);
    console.log("filas después:", JSON.stringify(despues));
    for (const t of INTACTAS) {
      if (antes[t] !== despues[t]) {
        console.log(`  FALLO ${t}: ${antes[t]} → ${despues[t]}`);
        ok = false;
      }
    }

    console.log(
      ok
        ? "\n✓ 024-026 aplicadas (tablas con RLS, RPC reemplazado, datos intactos)."
        : "\n✗ Revisar.",
    );
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
