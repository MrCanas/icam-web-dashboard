/**
 * Backfill de los metadatos que introduce la migración 018 (PM Planificación).
 *
 * NO migra datos: pm_activos / pm_hitos / pm_snapshot_fechas ya contienen todo lo
 * que muestra el Overview, y Planificación lee y escribe esas mismas tablas. Este
 * script solo rellena lo nuevo:
 *
 *   1. pm_snapshots       ← DISTINCT snapshot_code de pm_snapshot_fechas
 *   2. pm_hito_catalogo   ← DISTINCT hito de pm_hitos (color y es_puntual del código actual)
 *   3. pm_hitos.catalogo_id ← enlace por nombre
 *   4. pm_activos.orden   ← PM_PROJECT_ORDER_LEGACY, para que el Gantt no cambie de aspecto
 *
 * Los mapeos a la Tabla madre (pm_hito_catalogo.tabla_madre_columna) y a los
 * proyectos financieros (pm_activo_proyecto_map) se dejan VACÍOS a propósito: los
 * rellena la PMO en /dashboard/pm/proyectos. No se infiere ningún emparejamiento.
 *
 * Idempotente: se puede reejecutar. Hay que hacerlo después de cada restauración
 * del Excel (RPC replace_pm_portfolio), que borra las tres tablas y no conoce las
 * columnas nuevas.
 *
 *   npm run pm:backfill-planificacion -- --dry-run
 *   npm run pm:backfill-planificacion
 */
import type { PoolClient } from "pg";

import { getHitoColor } from "../../src/modules/pm/logic/pm-hito-palette";
import { PM_PROJECT_ORDER_LEGACY } from "../../src/modules/pm/logic/pm-project-order";
import { compareQuarterCodes, isPmPuntoHito } from "../../src/modules/pm/logic/pm-viz";
import { closePgPool, withPgClient } from "../actas/lib/db";

const DRY_RUN = process.argv.includes("--dry-run");

interface HitoRow {
  hito: string;
  orden_min: number;
}

/**
 * Orden canónico de hitos: el mismo criterio que usa la UI hoy
 * (collectCanonicalHitosFromPortfolio: por menor orden_hito, luego nombre).
 * Determina el índice de color de la paleta.
 */
function canonicalHitoOrder(rows: HitoRow[]): HitoRow[] {
  return [...rows].sort(
    (a, b) => a.orden_min - b.orden_min || a.hito.localeCompare(b.hito),
  );
}

/** levantamiento primero, luego trimestres en orden cronológico ascendente. */
function snapshotOrden(code: string, quarters: string[]): number {
  if (code === "levantamiento") return 0;
  const i = quarters.indexOf(code);
  return i >= 0 ? i + 1 : 900;
}

async function backfillSnapshots(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ snapshot_code: string }>(
    `SELECT DISTINCT snapshot_code FROM pm_snapshot_fechas`,
  );
  const codes = rows.map((r) => r.snapshot_code);
  const quarters = codes
    .filter((c) => c !== "levantamiento")
    .sort(compareQuarterCodes);

  const report: string[] = [];
  for (const code of codes) {
    const orden = snapshotOrden(code, quarters);
    report.push(`  ${code.padEnd(16)} orden=${orden}  visible=true`);
    if (DRY_RUN) continue;
    // ON CONFLICT DO NOTHING: no pisa visible_en_dashboard ni label si la PMO
    // ya los tocó. Reejecutar el backfill no debe deshacer sus decisiones.
    await client.query(
      `INSERT INTO pm_snapshots (snapshot_code, orden, visible_en_dashboard)
       VALUES ($1, $2, true)
       ON CONFLICT (snapshot_code) DO NOTHING`,
      [code, orden],
    );
  }
  return report;
}

async function backfillCatalogo(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ hito: string; orden_min: string }>(
    `SELECT hito, MIN(orden_hito) AS orden_min FROM pm_hitos GROUP BY hito`,
  );
  const canonical = canonicalHitoOrder(
    rows.map((r) => ({ hito: r.hito, orden_min: Number(r.orden_min) })),
  );

  const report: string[] = [];
  for (const [index, h] of canonical.entries()) {
    const color = getHitoColor(h.hito, index);
    const puntual = isPmPuntoHito(h.hito);
    report.push(
      `  ${String(h.orden_min).padStart(2)} ${h.hito.padEnd(26)} ${color}` +
        `${puntual ? "  [puntual]" : ""}`,
    );
    if (DRY_RUN) continue;
    // Solo rellena color/es_puntual/orden_default si están a NULL o por defecto:
    // nunca pisa lo que la PMO haya editado, ni el mapeo a la Tabla madre.
    await client.query(
      `INSERT INTO pm_hito_catalogo (nombre, orden_default, color, es_puntual)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (nombre) DO UPDATE
         SET color = COALESCE(pm_hito_catalogo.color, EXCLUDED.color),
             updated_at = now()`,
      [h.hito, h.orden_min, color, puntual],
    );
  }
  return report;
}

async function linkHitosToCatalogo(client: PoolClient): Promise<string> {
  if (DRY_RUN) {
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM pm_hitos WHERE catalogo_id IS NULL`,
    );
    return `  ${rows[0].n} hitos quedarían enlazados`;
  }
  const { rowCount } = await client.query(
    `UPDATE pm_hitos h
        SET catalogo_id = c.id
       FROM pm_hito_catalogo c
      WHERE c.nombre = h.hito
        AND h.catalogo_id IS DISTINCT FROM c.id`,
  );
  return `  ${rowCount} hitos enlazados a su entrada del catálogo`;
}

async function backfillActivoOrden(client: PoolClient): Promise<string[]> {
  const report: string[] = [];
  for (const [index, idActivo] of PM_PROJECT_ORDER_LEGACY.entries()) {
    report.push(`  ${String(index).padStart(2)} ${idActivo}`);
    if (DRY_RUN) continue;
    // Solo toca los que siguen a 0 (sin orden asignado): si la PMO ya reordenó
    // desde la UI, reejecutar el backfill no revierte su orden.
    await client.query(
      `UPDATE pm_activos SET orden = $2, updated_at = now()
        WHERE id_activo = $1 AND orden = 0`,
      [idActivo, index],
    );
  }
  return report;
}

async function main(): Promise<void> {
  console.log(
    DRY_RUN
      ? "DRY-RUN — no se escribe nada.\n"
      : "Aplicando backfill de PM Planificación.\n",
  );

  await withPgClient(async (client) => {
    // Falla pronto y con un mensaje útil si la migración no está aplicada.
    const { rows: tablas } = await client.query<{ n: string }>(
      `SELECT count(*) AS n FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('pm_hito_catalogo', 'pm_snapshots')`,
    );
    if (Number(tablas[0].n) < 2) {
      throw new Error(
        "Faltan pm_hito_catalogo / pm_snapshots. Aplica primero la migración\n" +
          "supabase/migrations/20260716120000_018_pm_planificacion.sql",
      );
    }

    if (!DRY_RUN) await client.query("BEGIN");
    try {
      console.log("1. pm_snapshots");
      console.log((await backfillSnapshots(client)).join("\n"));

      console.log("\n2. pm_hito_catalogo");
      console.log((await backfillCatalogo(client)).join("\n"));

      console.log("\n3. pm_hitos.catalogo_id");
      console.log(await linkHitosToCatalogo(client));

      console.log("\n4. pm_activos.orden");
      console.log((await backfillActivoOrden(client)).join("\n"));

      if (!DRY_RUN) await client.query("COMMIT");
    } catch (err) {
      if (!DRY_RUN) await client.query("ROLLBACK");
      throw err;
    }

    if (!DRY_RUN) {
      const { rows: huerfanos } = await client.query<{ hito: string }>(
        `SELECT DISTINCT hito FROM pm_hitos WHERE catalogo_id IS NULL`,
      );
      if (huerfanos.length) {
        console.log(
          `\nAVISO: ${huerfanos.length} hitos sin catálogo: ${huerfanos
            .map((h) => h.hito)
            .join(", ")}`,
        );
      }
    }
  });

  console.log(
    DRY_RUN
      ? "\nDRY-RUN terminado. Nada escrito."
      : "\nBackfill completado.\n\nSiguiente paso manual: mapear proyectos e hitos a la Tabla madre\nen /dashboard/pm/proyectos (se dejan vacíos a propósito).",
  );
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closePgPool());
