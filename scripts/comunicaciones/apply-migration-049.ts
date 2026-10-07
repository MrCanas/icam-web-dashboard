/**
 * Aplica la migración 049 — seguimiento de aperturas y clics, ensayo y reenvío.
 *
 * Añade columnas a `com_ajustes`, `com_comunicacion` y `com_destinatario`, crea
 * `com_enlace` y `com_evento`, la función `com_registrar_evento` y ensancha el
 * CHECK de `audiencia` con `reenvio`.
 *
 * Aditiva e idempotente. No envía nada y no toca los interruptores de envío.
 *
 * Dry-run por defecto: aplica, PRUEBA la función dentro de la transacción,
 * enseña cómo queda y revierte.
 *
 *   npm run comunicaciones:apply-migration-049
 *   npm run comunicaciones:apply-migration-049 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "../pm/lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261006200000_049_comunicaciones_analitica.sql",
);

const COLUMNAS_ESPERADAS: Record<string, string[]> = {
  com_ajustes: ["limite_diario"],
  com_comunicacion: [
    "modo_envio",
    "asunto_enviado",
    "imagen_apertura",
    "prueba_token",
    "prueba_enlaces",
    "ensayo_at",
    "ensayo_por_email",
    "ensayo_resumen",
    "origen_comunicacion_id",
    "reenvio_filtro",
  ],
  com_destinatario: [
    "seguimiento_token",
    "enlaces",
    "huella",
    "aperturas",
    "primera_apertura_at",
    "ultima_apertura_at",
    "clics",
    "primer_clic_at",
    "ultimo_clic_at",
    "entrega_estado",
    "rebote_motivo",
    "entrega_consultada_at",
    "verificado_zoho",
  ],
};

async function main(): Promise<void> {
  cargarEnv();
  const aplicar = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  console.log(
    aplicar
      ? "APLICANDO la migración 049.\n"
      : "Simulación de la migración 049: se aplica y se revierte.\n" +
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
          WHERE table_schema = 'public'
            AND table_name IN ('com_ajustes', 'com_comunicacion', 'com_destinatario')`,
      );
      let faltan = 0;
      for (const [tabla, esperadas] of Object.entries(COLUMNAS_ESPERADAS)) {
        for (const columna of esperadas) {
          if (!columnas.some((c) => c.tabla === tabla && c.columna === columna)) {
            faltan++;
            problemas.push(`falta ${tabla}.${columna}`);
          }
        }
      }
      const total = Object.values(COLUMNAS_ESPERADAS).reduce((n, l) => n + l.length, 0);
      console.log(`Columnas nuevas: ${total - faltan} de ${total}`);

      const { rows: tablas } = await client.query<{ tabla: string; rls: boolean; politicas: number }>(
        `SELECT c.relname AS tabla, c.relrowsecurity AS rls,
                (SELECT count(*)::int FROM pg_policies p
                  WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS politicas
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname LIKE 'com\\_%' AND c.relkind = 'r'
          ORDER BY c.relname`,
      );
      console.log("\nTablas com_*:");
      for (const t of tablas) console.log(`  ${t.tabla} — RLS ${t.rls ? "sí" : "NO"}, ${t.politicas} políticas`);
      if (tablas.length !== 5) problemas.push(`se esperaban 5 tablas com_* y hay ${tablas.length}`);
      if (tablas.some((t) => !t.rls || t.politicas !== 0)) {
        problemas.push("alguna tabla com_* no tiene RLS habilitada sin políticas");
      }

      const { rows: checks } = await client.query<{ nombre: string; definicion: string }>(
        `SELECT con.conname AS nombre, pg_get_constraintdef(con.oid) AS definicion
           FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
          WHERE c.relname = 'com_comunicacion' AND con.conname = 'com_comunicacion_audiencia_check'`,
      );
      console.log(`\nCHECK de audiencia: ${checks[0]?.definicion ?? "(no existe)"}`);
      if (!checks[0]?.definicion.includes("reenvio")) problemas.push("el CHECK de audiencia no admite «reenvio»");

      const { rows: permisos } = await client.query<{ rol: string; puede: boolean }>(
        `SELECT r.rolname AS rol,
                has_function_privilege(r.rolname, 'public.com_registrar_evento(text, text, integer, text, boolean)', 'EXECUTE') AS puede
           FROM pg_roles r WHERE r.rolname IN ('anon', 'authenticated', 'service_role') ORDER BY 1`,
      );
      console.log("\nQuién puede ejecutar com_registrar_evento:");
      for (const p of permisos) console.log(`  ${p.rol}: ${p.puede ? "sí" : "no"}`);
      if (permisos.some((p) => p.rol !== "service_role" && p.puede)) {
        problemas.push("anon o authenticated pueden ejecutar com_registrar_evento");
      }
      if (!permisos.some((p) => p.rol === "service_role" && p.puede)) {
        problemas.push("service_role no puede ejecutar com_registrar_evento");
      }

      // La función, probada con una comunicación inventada que se revierte con
      // el SAVEPOINT aunque la migración se confirme.
      await client.query("SAVEPOINT prueba_funcion");
      const { rows: com } = await client.query<{ id: string }>(
        `INSERT INTO public.com_comunicacion (nombre, tipo, audiencia, creada_por_email, prueba_token, prueba_enlaces)
         VALUES ('prueba 049', 'otro', 'toda_la_base', 'script', 'tok-prueba', '["https://ejemplo.com/p"]'::jsonb)
         RETURNING id`,
      );
      const { rows: dest } = await client.query<{ id: string }>(
        `INSERT INTO public.com_destinatario
           (comunicacion_id, cuenta_zoho_id, cuenta_nombre, estado_envio, enviado_at, seguimiento_token, enlaces)
         VALUES ($1, 'x', 'Cuenta inventada', 'enviado', now() - interval '1 hour', 'tok-dest',
                 '["https://ejemplo.com/a", "https://ejemplo.com/b"]'::jsonb)
         RETURNING id`,
        [com[0]!.id],
      );
      const llamar = async (token: string, tipo: string, enlace: number | null, auto = false) =>
        (
          await client.query<{ encontrado: boolean; destino: string | null; imagen: string | null }>(
            "SELECT * FROM public.com_registrar_evento($1, $2, $3, 'agente de prueba', $4)",
            [token, tipo, enlace, auto],
          )
        ).rows[0]!;
      const casos: [string, boolean][] = [
        ["apertura de un destinatario", (await llamar("tok-dest", "apertura", null)).encontrado === true],
        ["clic devuelve el destino guardado", (await llamar("tok-dest", "clic", 1)).destino === "https://ejemplo.com/b"],
        ["clic fuera de rango no se encuentra", (await llamar("tok-dest", "clic", 2)).encontrado === false],
        ["clic con índice negativo no se encuentra", (await llamar("tok-dest", "clic", -1)).encontrado === false],
        ["identificador desconocido no se encuentra", (await llamar("no-existe", "apertura", null)).encontrado === false],
        ["tipo desconocido no se encuentra", (await llamar("tok-dest", "otra-cosa", null)).encontrado === false],
        ["la prueba se encuentra", (await llamar("tok-prueba", "clic", 0)).destino === "https://ejemplo.com/p"],
        ["una lectura automática se encuentra", (await llamar("tok-dest", "apertura", null, true)).encontrado === true],
      ];
      const { rows: tras } = await client.query<{ aperturas: number; clics: number; eventos: number; de_prueba: number }>(
        `SELECT d.aperturas, d.clics,
                (SELECT count(*)::int FROM public.com_evento e WHERE e.comunicacion_id = d.comunicacion_id) AS eventos,
                (SELECT count(*)::int FROM public.com_evento e WHERE e.comunicacion_id = d.comunicacion_id AND e.es_prueba) AS de_prueba
           FROM public.com_destinatario d WHERE d.id = $1`,
        [dest[0]!.id],
      );
      const t = tras[0]!;
      // 1 apertura real + 1 automática (no suma) + 1 clic real; la prueba no suma.
      casos.push(["las cifras solo cuentan lo no automático y lo que no es prueba", t.aperturas === 1 && t.clics === 1]);
      casos.push(["se guardan los 4 eventos válidos, uno de ellos de prueba", t.eventos === 4 && t.de_prueba === 1]);
      console.log("\nLa función com_registrar_evento:");
      for (const [nombre, ok] of casos) {
        console.log(`  ${ok ? "✓" : "✗"} ${nombre}`);
        if (!ok) problemas.push(`com_registrar_evento: ${nombre}`);
      }
      await client.query("ROLLBACK TO SAVEPOINT prueba_funcion");

      const { rows: ajustes } = await client.query<{ envios_activados: boolean; modo: string; limite_diario: number }>(
        "SELECT envios_activados, modo, limite_diario FROM public.com_ajustes",
      );
      const a = ajustes[0];
      console.log(
        `\nAjustes: envíos ${a?.envios_activados ? "ACTIVADOS" : "desactivados"} · modo ${a?.modo ?? "?"} · tope diario ${a?.limite_diario ?? "?"}`,
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
