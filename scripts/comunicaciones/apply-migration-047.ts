/**
 * Aplica la migración 047 — el módulo Comunicaciones.
 *
 * Crea la zona `comunicaciones`, las tablas `com_ajustes`, `com_comunicacion` y
 * `com_destinatario`, y añade dos columnas al espejo de Inversores
 * (`inv_cuentas.tiene_intermediario`, `inv_contactos.email_opt_out`) con su
 * fila en `inv_campo_catalogo`.
 *
 * Aditiva e idempotente. Nada de lo que crea envía un correo, y `com_ajustes`
 * nace con los envíos desactivados y en modo pruebas.
 *
 * Dry-run por defecto: aplica, enseña cómo queda y revierte.
 *
 *   npm run comunicaciones:apply-migration-047
 *   npm run comunicaciones:apply-migration-047 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "../pm/lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261006120000_047_comunicaciones.sql",
);

async function main(): Promise<void> {
  cargarEnv();
  const aplicar = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  console.log(
    aplicar
      ? "APLICANDO la migración 047.\n"
      : "Simulación de la migración 047: se aplica y se revierte.\n" +
          "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      // Segunda pasada: si algo no fuera idempotente, saldría aquí.
      await client.query(sql);

      const { rows: zonas } = await client.query<{ key: string; label: string; sort_order: number }>(
        "SELECT key, label, sort_order FROM public.app_zone ORDER BY sort_order",
      );
      console.log("Zonas del portal:");
      for (const z of zonas) console.log(`  ${z.sort_order}. ${z.key} — ${z.label}`);

      const { rows: concedidos } = await client.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM public.app_user_zone_role WHERE zone_key = 'comunicaciones'",
      );
      console.log(`\nUsuarios con la zona Comunicaciones: ${concedidos[0]?.n ?? 0}`);

      const { rows: ajustes } = await client.query<{ envios_activados: boolean; modo: string; filas: number }>(
        `SELECT envios_activados, modo, (SELECT count(*)::int FROM public.com_ajustes) AS filas
           FROM public.com_ajustes`,
      );
      const a = ajustes[0];
      console.log(
        `Ajustes: ${a?.filas ?? 0} fila · envíos ${a?.envios_activados ? "ACTIVADOS" : "desactivados"} · modo ${a?.modo ?? "?"}`,
      );

      const { rows: catalogo } = await client.query<{ modulo: string; destino: string; zoho_api_name: string }>(
        `SELECT modulo, destino, zoho_api_name FROM public.inv_campo_catalogo
          WHERE destino IN ('tiene_intermediario', 'email_opt_out') ORDER BY modulo`,
      );
      console.log("\nCampos nuevos en el catálogo de Inversores:");
      for (const c of catalogo) console.log(`  ${c.modulo}.${c.zoho_api_name} → ${c.destino}`);

      const { rows: tablas } = await client.query<{ tabla: string; rls: boolean; politicas: number }>(
        `SELECT c.relname AS tabla, c.relrowsecurity AS rls,
                (SELECT count(*)::int FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname LIKE 'com\\_%' AND c.relkind = 'r'
          ORDER BY c.relname`,
      );
      console.log("\nTablas com_*:");
      for (const t of tablas) {
        console.log(`  ${t.tabla} — RLS ${t.rls ? "sí" : "NO"}, ${t.politicas} políticas`);
      }

      const problemas: string[] = [];
      if (!zonas.some((z) => z.key === "comunicaciones")) problemas.push("falta la zona comunicaciones");
      if (!a || a.filas !== 1 || a.envios_activados || a.modo !== "pruebas") {
        problemas.push("com_ajustes no nace con una sola fila, envíos desactivados y modo pruebas");
      }
      if (catalogo.length !== 2) problemas.push(`se esperaban 2 campos nuevos en el catálogo y hay ${catalogo.length}`);
      if (tablas.length !== 3) problemas.push(`se esperaban 3 tablas com_* y hay ${tablas.length}`);
      if (tablas.some((t) => !t.rls || t.politicas !== 0)) {
        problemas.push("alguna tabla com_* no tiene RLS habilitada sin políticas");
      }
      for (const p of problemas) console.log(`\n  ✗ ${p}`);
      const ok = problemas.length === 0;

      if (aplicar && ok) {
        await client.query("COMMIT");
        console.log("\n✓ Migración aplicada.");
        return;
      }
      await client.query("ROLLBACK");
      console.log(
        aplicar ? "\n✗ La verificación falló: ROLLBACK." : ok ? "\n✓ Simulación correcta: ROLLBACK hecho." : "\n✗ La simulación encontró problemas: ROLLBACK hecho.",
      );
      if (!ok) process.exitCode = 1;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });

  await closePgPool();
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
