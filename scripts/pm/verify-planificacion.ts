/**
 * Verificación de PM Planificación contra Supabase.
 *
 * Comprueba lo que de verdad puede romperse al dejar de depender del Excel:
 *   1. Nada se ha perdido: el backfill no toca los datos del Overview.
 *   2. La desviación DERIVADA coincide con la que traía el Excel → los KPIs no cambian.
 *   3. Todo hito tiene entrada de catálogo y todo snapshot está registrado.
 *   4. Congelar un snapshot es idempotente (se prueba y se revierte).
 *
 * Solo lee, salvo la prueba 4, que escribe dentro de una transacción con ROLLBACK.
 *
 *   npm run pm:verify-planificacion
 */
import type { PoolClient } from "pg";

import type { PmHitoEnriched } from "../../src/modules/pm/data/pmRepository";
import { meanAbsLevantamiento } from "../../src/modules/pm/logic/pm-kpis";
import { deviationVsLevantamientoDays } from "../../src/modules/pm/logic/pm-viz";
import { closePgPool, withPgClient } from "../actas/lib/db";

let fallos = 0;

function check(ok: boolean, label: string, detalle = ""): void {
  console.log(`  ${ok ? "OK  " : "FALLO"} ${label}${detalle ? ` — ${detalle}` : ""}`);
  if (!ok) fallos++;
}

interface RawHito {
  id: string;
  activo_id: string;
  id_activo: string;
  hito: string;
  orden_hito: number;
  fecha_actual: string | null;
  desviacion_vs_levantamiento_dias: number | null;
  catalogo_id: string | null;
}

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

async function loadHitos(client: PoolClient): Promise<{
  hitos: PmHitoEnriched[];
  raw: RawHito[];
  codes: string[];
}> {
  const { rows: raw } = await client.query<RawHito>(
    `SELECT h.id, h.activo_id, a.id_activo, h.hito, h.orden_hito, h.fecha_actual,
            h.desviacion_vs_levantamiento_dias, h.catalogo_id
       FROM pm_hitos h JOIN pm_activos a ON a.id = h.activo_id`,
  );
  const { rows: snaps } = await client.query<{
    hito_id: string;
    snapshot_code: string;
    fecha: string | null;
  }>(`SELECT hito_id, snapshot_code, fecha FROM pm_snapshot_fechas`);

  const byHito = new Map<string, Record<string, string | null>>();
  const codes = new Set<string>();
  for (const s of snaps) {
    codes.add(s.snapshot_code);
    if (!byHito.has(s.hito_id)) byHito.set(s.hito_id, {});
    byHito.get(s.hito_id)![s.snapshot_code] = toIso(s.fecha);
  }

  const hitos: PmHitoEnriched[] = raw.map((r) => ({
    id: r.id,
    activo_id: r.activo_id,
    hito: r.hito,
    orden_hito: r.orden_hito,
    fecha_actual: toIso(r.fecha_actual),
    desviacion_vs_anterior_dias: null,
    desviacion_vs_levantamiento_dias: r.desviacion_vs_levantamiento_dias,
    snapshots: byHito.get(r.id) ?? {},
  }));

  return { hitos, raw, codes: [...codes].sort() };
}

async function main(): Promise<void> {
  await withPgClient(async (client) => {
    const { hitos, raw, codes } = await loadHitos(client);

    console.log("\n1. Datos del Overview intactos");
    const { rows: c } = await client.query<{ activos: number; hitos: number; fechas: number }>(
      `SELECT (SELECT count(*)::int FROM pm_activos) activos,
              (SELECT count(*)::int FROM pm_hitos) hitos,
              (SELECT count(*)::int FROM pm_snapshot_fechas) fechas`,
    );
    check(c[0].activos > 0, `${c[0].activos} activos`);
    check(c[0].hitos > 0, `${c[0].hitos} hitos`);
    check(c[0].fechas > 0, `${c[0].fechas} fechas de snapshot`);

    console.log("\n2. Desviación derivada vs la del Excel (los KPIs no deben cambiar)");
    let comparables = 0;
    const discrepancias: string[] = [];
    for (const h of hitos) {
      const derivada = deviationVsLevantamientoDays(h);
      const almacenada = h.desviacion_vs_levantamiento_dias;
      if (almacenada == null) {
        // Si el Excel no traía valor, la derivada tampoco debería inventarlo:
        // haría subir la media del KPI respecto a lo que se ve hoy.
        if (derivada != null) {
          discrepancias.push(`${h.hito}: Excel=NULL derivada=${derivada}`);
        }
        continue;
      }
      comparables++;
      if (derivada !== almacenada) {
        discrepancias.push(`${h.hito}: Excel=${almacenada} derivada=${derivada}`);
      }
    }
    check(
      discrepancias.length === 0,
      `${comparables} hitos comparados`,
      discrepancias.length ? discrepancias.slice(0, 5).join(" | ") : "coinciden todos",
    );

    console.log("\n3. Backfill completo");
    check(
      raw.every((r) => r.catalogo_id !== null),
      "todo hito tiene entrada de catálogo",
      `${raw.filter((r) => r.catalogo_id === null).length} sin enlazar`,
    );
    const { rows: sinReg } = await client.query<{ snapshot_code: string }>(
      `SELECT DISTINCT f.snapshot_code FROM pm_snapshot_fechas f
        WHERE NOT EXISTS (SELECT 1 FROM pm_snapshots s WHERE s.snapshot_code = f.snapshot_code)`,
    );
    check(
      sinReg.length === 0,
      "todo snapshot_code está registrado en pm_snapshots",
      sinReg.map((s) => s.snapshot_code).join(", "),
    );
    const { rows: ord } = await client.query<{ n: number }>(
      `SELECT count(*)::int n FROM pm_activos WHERE orden = 0`,
    );
    check(ord[0].n <= 1, "los activos tienen orden asignado", `${ord[0].n} con orden=0`);

    console.log("\n4. Congelar snapshot es idempotente (en transacción, con rollback)");
    await client.query("BEGIN");
    try {
      const CODE = "__verify_tmp__";
      const freeze = `
        INSERT INTO pm_snapshot_fechas (hito_id, snapshot_code, fecha)
        SELECT h.id, $1, h.fecha_actual FROM pm_hitos h WHERE h.fecha_actual IS NOT NULL
        ON CONFLICT (hito_id, snapshot_code) DO UPDATE SET fecha = EXCLUDED.fecha`;

      await client.query(`INSERT INTO pm_snapshots (snapshot_code, orden) VALUES ($1, 999)`, [CODE]);
      await client.query(freeze, [CODE]);
      const n1 = (
        await client.query<{ n: number }>(
          `SELECT count(*)::int n FROM pm_snapshot_fechas WHERE snapshot_code = $1`,
          [CODE],
        )
      ).rows[0].n;

      await client.query(freeze, [CODE]);
      const n2 = (
        await client.query<{ n: number }>(
          `SELECT count(*)::int n FROM pm_snapshot_fechas WHERE snapshot_code = $1`,
          [CODE],
        )
      ).rows[0].n;

      check(n1 > 0, `congelar creó ${n1} fechas`);
      check(n1 === n2, "congelar dos veces no duplica", `${n1} → ${n2}`);
    } finally {
      await client.query("ROLLBACK");
    }

    console.log("\n5. Archivar y publicar no borran fechas (en transacción, con rollback)");
    await client.query("BEGIN");
    try {
      const antes = (
        await client.query<{ n: number }>(`SELECT count(*)::int n FROM pm_snapshot_fechas`)
      ).rows[0].n;

      // Archivar un hito con histórico: sus fechas deben sobrevivir.
      const victima = (
        await client.query<{ id: string; n: number }>(
          `SELECT h.id, count(s.id)::int n FROM pm_hitos h
             JOIN pm_snapshot_fechas s ON s.hito_id = h.id
            GROUP BY h.id HAVING count(s.id) > 0 LIMIT 1`,
        )
      ).rows[0];
      await client.query(`UPDATE pm_hitos SET archivado_at = now() WHERE id = $1`, [victima.id]);
      const trasArchivar = (
        await client.query<{ n: number }>(
          `SELECT count(*)::int n FROM pm_snapshot_fechas WHERE hito_id = $1`,
          [victima.id],
        )
      ).rows[0].n;
      check(
        trasArchivar === victima.n,
        "archivar un hito conserva sus fechas de snapshot",
        `${victima.n} → ${trasArchivar}`,
      );

      // Retirar un trimestre de un proyecto: tampoco toca ninguna fecha.
      const activo = (
        await client.query<{ id: string }>(`SELECT id FROM pm_activos LIMIT 1`)
      ).rows[0];
      await client.query(
        `INSERT INTO pm_activo_snapshot (activo_id, snapshot_code, publicado)
         VALUES ($1, 'levantamiento', false)`,
        [activo.id],
      );
      const despues = (
        await client.query<{ n: number }>(`SELECT count(*)::int n FROM pm_snapshot_fechas`)
      ).rows[0].n;
      check(antes === despues, "retirar un trimestre no borra fechas", `${antes} → ${despues}`);

      // Congelar selectivo: solo el proyecto elegido.
      await client.query(`DELETE FROM pm_snapshot_fechas WHERE snapshot_code = '2099_Q1'`);
      await client.query(
        `INSERT INTO pm_snapshots (snapshot_code, orden) VALUES ('2099_Q1', 998)
         ON CONFLICT DO NOTHING`,
      );
      await client.query(`SELECT congelar_pm_snapshot('2099_Q1', ARRAY[$1::uuid])`, [
        activo.id,
      ]);
      const afectados = (
        await client.query<{ n: number }>(
          `SELECT count(DISTINCT h.activo_id)::int n FROM pm_snapshot_fechas s
             JOIN pm_hitos h ON h.id = s.hito_id
            WHERE s.snapshot_code = '2099_Q1'`,
        )
      ).rows[0].n;
      check(afectados === 1, "congelar selectivo solo toca el proyecto elegido", `${afectados} proyecto(s)`);

      // Y no congela el hito archivado.
      const archivadoCongelado = (
        await client.query<{ n: number }>(
          `SELECT count(*)::int n FROM pm_snapshot_fechas
            WHERE snapshot_code = '2099_Q1' AND hito_id = $1`,
          [victima.id],
        )
      ).rows[0].n;
      check(archivadoCongelado === 0, "congelar ignora los hitos archivados");
    } finally {
      await client.query("ROLLBACK");
    }

    console.log("\n6. Media de desviación por proyecto (lo que muestra el KPI)");
    const porActivo = new Map<string, PmHitoEnriched[]>();
    for (const [i, h] of hitos.entries()) {
      const id = raw[i].id_activo;
      if (!porActivo.has(id)) porActivo.set(id, []);
      h.desviacion_lev_derivada = deviationVsLevantamientoDays(h);
      porActivo.get(id)!.push(h);
    }
    for (const [id, list] of [...porActivo].sort()) {
      const media = meanAbsLevantamiento({
        activo: { id: "", id_activo: id, tipo_uso_activo: "APT", nombre_display: null },
        hitos: list,
      });
      console.log(
        `  ${id.padEnd(22)} ${media == null ? "—" : `${Math.round(media / 30)} m (${Math.round(media)} d)`}`,
      );
    }
  });

  console.log(
    fallos === 0
      ? "\nVerificación OK — nada roto."
      : `\n${fallos} comprobaciones FALLIDAS.`,
  );
  if (fallos > 0) process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closePgPool());
