/**
 * Aplica la migración 048 — las columnas del envío de Comunicaciones.
 *
 * Añade a `com_comunicacion` la prueba enviada y la pasarela, a
 * `com_destinatario` a quién salió de verdad cada correo, y ensancha el CHECK
 * de `estado_envio` con `omitido`.
 *
 * Aditiva e idempotente. No envía nada y no toca `com_ajustes`: los envíos
 * siguen como estuvieran.
 *
 * Dry-run por defecto: aplica, enseña cómo queda y revierte.
 *
 *   npm run comunicaciones:apply-migration-048
 *   npm run comunicaciones:apply-migration-048 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "../pm/lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261006180000_048_comunicaciones_envio.sql",
);

const COLUMNAS_ESPERADAS: Record<string, string[]> = {
  com_comunicacion: [
    "pasarela",
    "prueba_enviada_at",
    "prueba_enviada_plantilla_id",
    "prueba_enviada_por_email",
    "prueba_message_id",
  ],
  com_destinatario: ["enviado_para", "pasarela"],
};

async function main(): Promise<void> {
  cargarEnv();
  const aplicar = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  console.log(
    aplicar
      ? "APLICANDO la migración 048.\n"
      : "Simulación de la migración 048: se aplica y se revierte.\n" +
          "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      // Segunda pasada: si algo no fuera idempotente, saldría aquí.
      await client.query(sql);

      const problemas: string[] = [];

      const { rows: columnas } = await client.query<{ tabla: string; columna: string }>(
        `SELECT table_name AS tabla, column_name AS columna
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name IN ('com_comunicacion', 'com_destinatario')`,
      );
      console.log("Columnas nuevas:");
      for (const [tabla, esperadas] of Object.entries(COLUMNAS_ESPERADAS)) {
        for (const columna of esperadas) {
          const esta = columnas.some((c) => c.tabla === tabla && c.columna === columna);
          console.log(`  ${esta ? "✓" : "✗"} ${tabla}.${columna}`);
          if (!esta) problemas.push(`falta ${tabla}.${columna}`);
        }
      }

      const { rows: checks } = await client.query<{ nombre: string; definicion: string }>(
        `SELECT con.conname AS nombre, pg_get_constraintdef(con.oid) AS definicion
           FROM pg_constraint con
           JOIN pg_class c ON c.oid = con.conrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'com_destinatario' AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) LIKE '%estado_envio%'`,
      );
      console.log("\nCHECK de com_destinatario.estado_envio:");
      for (const c of checks) console.log(`  ${c.nombre}: ${c.definicion}`);
      if (checks.length !== 1) {
        problemas.push(`se esperaba 1 CHECK sobre estado_envio y hay ${checks.length}`);
      } else if (!checks[0]!.definicion.includes("omitido")) {
        problemas.push("el CHECK de estado_envio no admite «omitido»");
      }

      const { rows: estados } = await client.query<{ estado_envio: string; n: number }>(
        "SELECT estado_envio, count(*)::int AS n FROM public.com_destinatario GROUP BY 1 ORDER BY 1",
      );
      console.log("\nDestinatarios guardados, por estado de envío:");
      if (estados.length === 0) console.log("  (ninguno)");
      for (const e of estados) console.log(`  ${e.estado_envio}: ${e.n}`);

      const { rows: ajustes } = await client.query<{ envios_activados: boolean; modo: string }>(
        "SELECT envios_activados, modo FROM public.com_ajustes",
      );
      const a = ajustes[0];
      console.log(
        `\nAjustes (esta migración no los toca): envíos ${a?.envios_activados ? "ACTIVADOS" : "desactivados"} · modo ${a?.modo ?? "?"}`,
      );

      for (const p of problemas) console.log(`\n  ✗ ${p}`);
      const ok = problemas.length === 0;

      if (aplicar && ok) {
        await client.query("COMMIT");
        console.log("\n✓ Migración aplicada.");
        return;
      }
      await client.query("ROLLBACK");
      console.log(
        aplicar
          ? "\n✗ La verificación falló: ROLLBACK."
          : ok
            ? "\n✓ Simulación correcta: ROLLBACK hecho."
            : "\n✗ La simulación encontró problemas: ROLLBACK hecho.",
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
