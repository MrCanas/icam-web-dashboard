/**
 * Aplica la migración 036 — alta de VE1 y LSE84 en pm_activos.
 *
 * Los dos vivían solo en Actas y en las promociones de Zoho: pm_activos la
 * puebla el Excel PM, que trae únicamente los nueve activos del Gantt
 * histórico, así que nunca aparecieron en PM → Proyectos.
 *
 * Aditiva e idempotente: INSERT ... ON CONFLICT DO NOTHING y un UPDATE del
 * vínculo de Actas solo donde está a NULL. No borra ni pisa nada.
 *
 * La verificación no da por bueno «no falló»: comprueba que los dos activos
 * existen, que siguen sin hitos (nacen vacíos a propósito), que el vínculo con
 * Actas resuelve en las dos direcciones y que no se ha tocado ningún otro
 * activo ni ningún otro proyecto de Actas.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-036
 *   npm run pm:apply-migration-036 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260903120000_036_alta_ve1_lse84.sql",
);

/** Los códigos que da de alta la migración. */
const CODIGOS = ["VE1", "LSE84"] as const;

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

function pintarActivos(filas: ActivoFila[]): void {
  for (const a of filas) {
    const marca = (CODIGOS as readonly string[]).includes(a.id_activo) ? "→" : " ";
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
    const antes = await activos(client);
    const antesActas = await proyectosActas(client);

    console.log(`— antes —  ${antes.length} activo(s) en pm_activos`);
    pintarActivos(antes);
    const faltan = CODIGOS.filter((c) => !antes.some((a) => a.id_activo === c));
    console.log(
      faltan.length
        ? `\n  falta(n) por dar de alta: ${faltan.join(", ")}`
        : "\n  VE1 y LSE84 ya están de alta; la migración no cambiará nada",
    );
    for (const c of CODIGOS) {
      const p = antesActas.find((x) => x.code === c);
      console.log(
        p
          ? `  actas «${c}»: ${p.pm_activo_id ? `vinculado a ${p.activo_vinculado}` : "sin vincular"}`
          : `  actas «${c}»: NO existe el proyecto de Actas`,
      );
    }

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    console.log("\naplicando migración 036…");
    await client.query(sql);

    const despues = await activos(client);
    const despuesActas = await proyectosActas(client);

    console.log(`\n— después —  ${despues.length} activo(s) en pm_activos`);
    pintarActivos(despues);

    const problemas: string[] = [];

    // 1. Los dos existen, activos y sin hitos.
    for (const c of CODIGOS) {
      const a = despues.find((x) => x.id_activo === c);
      if (!a) {
        problemas.push(`${c} no está en pm_activos`);
        continue;
      }
      if (a.archivado_at) problemas.push(`${c} ha nacido archivado`);
      if (a.hitos !== 0) problemas.push(`${c} tiene ${a.hitos} hito(s); debería nacer vacío`);
    }

    // 2. El vínculo con Actas resuelve en las dos direcciones.
    for (const c of CODIGOS) {
      const p = despuesActas.find((x) => x.code === c);
      if (!p) {
        problemas.push(`no existe el proyecto de Actas «${c}» que vincular`);
        continue;
      }
      if (p.activo_vinculado !== c) {
        problemas.push(
          `actas «${c}» apunta a ${p.activo_vinculado ?? "nada"} en vez de a ${c}`,
        );
      }
    }

    // 3. Nada más ha cambiado: ni un activo previo ni otro proyecto de Actas.
    for (const a of antes) {
      const d = despues.find((x) => x.id === a.id);
      if (!d) {
        problemas.push(`ha desaparecido el activo ${a.id_activo}`);
        continue;
      }
      if (
        d.id_activo !== a.id_activo ||
        d.tipo_uso_activo !== a.tipo_uso_activo ||
        d.nombre_display !== a.nombre_display ||
        d.orden !== a.orden ||
        d.archivado_at !== a.archivado_at ||
        d.hitos !== a.hitos
      ) {
        problemas.push(`el activo ${a.id_activo} ha cambiado y no debía`);
      }
    }
    for (const p of antesActas) {
      if ((CODIGOS as readonly string[]).includes(p.code)) continue;
      const d = despuesActas.find((x) => x.code === p.code);
      if (d?.pm_activo_id !== p.pm_activo_id) {
        problemas.push(`el vínculo de actas «${p.code}» ha cambiado y no debía`);
      }
    }

    console.log("");
    if (problemas.length === 0) {
      console.log(
        "✓ Migración 036 OK. VE1 y LSE84 están de alta, sin hitos, vinculados a su acta " +
          "y sin tocar nada más.\n" +
          "  Queda para la PMO, desde PM → Proyectos: mapear cada uno al maestro " +
          "financiero y a su promoción de Zoho, y añadirles hitos en Planificación.",
      );
    } else {
      for (const p of problemas) console.log(`✗ ${p}`);
      process.exitCode = 1;
    }
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
