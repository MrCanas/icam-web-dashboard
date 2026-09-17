/**
 * Aplica la migración 041 — marca las cuentas que no cuentan.
 *
 * Añade `excluida` / `excluida_motivo` a `inv_cuentas` y marca las siete
 * cuentas de prueba o técnicas detectadas el 2026-09-16.
 *
 * Aditiva e idempotente: `ADD COLUMN IF NOT EXISTS` y un UPDATE que solo toca
 * lo que aún no está marcado. No borra ninguna fila; desmarcar es poner
 * `excluida = false`.
 *
 * Dry-run por defecto: aplica, enseña el efecto sobre los totales y revierte.
 *
 *   npm run inversores:apply-migration-041
 *   npm run inversores:apply-migration-041 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "../pm/lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260916140000_041_inversores_cuentas_excluidas.sql",
);

const eur = (v: unknown) =>
  `${Number(v ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 0 })} €`;

/** Los totales tal y como los calcula la pantalla, sobre las cuentas vivas. */
async function totales(client: PoolClient) {
  const { rows } = await client.query<{
    cuentas: number;
    comprometido: string;
    aportado: string;
    repartido: string;
  }>(
    `SELECT
       (SELECT count(*)::int FROM public.inv_cuentas
         WHERE borrado_at IS NULL AND NOT excluida) AS cuentas,
       (SELECT coalesce(sum(cp.importe_comprometido),0) FROM public.inv_cuenta_promocion cp
          JOIN public.inv_cuentas cu ON cu.zoho_id = cp.cuenta_zoho_id
         WHERE cp.borrado_at IS NULL AND cu.borrado_at IS NULL AND NOT cu.excluida) AS comprometido,
       (SELECT coalesce(sum(f.importe),0) FROM public.inv_flujos f
          JOIN public.inv_cuentas cu ON cu.zoho_id = f.cuenta_zoho_id
         WHERE f.borrado_at IS NULL AND cu.borrado_at IS NULL AND NOT cu.excluida
           AND f.tipo = 'aporte') AS aportado,
       (SELECT coalesce(sum(f.importe),0) FROM public.inv_flujos f
          JOIN public.inv_cuentas cu ON cu.zoho_id = f.cuenta_zoho_id
         WHERE f.borrado_at IS NULL AND cu.borrado_at IS NULL AND NOT cu.excluida
           AND f.tipo = 'reparto') AS repartido`,
  );
  return rows[0];
}

async function main(): Promise<void> {
  cargarEnv();
  const aplicar = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  console.log(
    aplicar
      ? "APLICANDO la migración 041.\n"
      : "Simulación de la migración 041: se aplica y se revierte.\n" +
          "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      // Segunda pasada: si el UPDATE no fuera idempotente, saldría aquí.
      await client.query(sql);

      const { rows: marcadas } = await client.query<{ nombre: string; motivo: string }>(
        `SELECT nombre, excluida_motivo AS motivo FROM public.inv_cuentas
          WHERE excluida AND borrado_at IS NULL ORDER BY nombre`,
      );
      console.log(`Cuentas excluidas (${marcadas.length}):`);
      for (const m of marcadas) console.log(`  · ${m.nombre}`);

      const t = await totales(client);
      console.log("\nTotales que verá la pantalla:");
      console.log(`  cuentas      : ${t.cuentas}`);
      console.log(`  comprometido : ${eur(t.comprometido)}`);
      console.log(`  aportado     : ${eur(t.aportado)}`);
      console.log(`  repartido    : ${eur(t.repartido)}  (oculto en la UI)`);

      const ok = marcadas.length === 7;
      if (!ok) console.log(`\n  ✗ Se esperaban 7 cuentas marcadas y hay ${marcadas.length}.`);

      if (aplicar && ok) {
        await client.query("COMMIT");
        console.log("\n✓ Migración aplicada.");
        return;
      }
      await client.query("ROLLBACK");
      console.log(
        aplicar
          ? "\n✗ La verificación falló: ROLLBACK."
          : "\n✓ Simulación correcta: ROLLBACK hecho.",
      );
      if (aplicar) process.exitCode = 1;
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
