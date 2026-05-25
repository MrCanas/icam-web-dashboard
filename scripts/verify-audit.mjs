/**
 * Verificación manual de audit_log — ejecutar tras aplicar la migration:
 *   node scripts/verify-audit.mjs
 *
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const ctx = {
  id: "mock-admin",
  email: "admin@icam.es",
  name: "Admin Mock",
  roles: ["admin"],
};

function mutationFailed(result) {
  if (result == null || typeof result !== "object") return false;
  return "error" in result && result.error != null;
}

async function withAudit(action, meta, fn) {
  const result = await fn();
  if (mutationFailed(result)) {
    throw new Error(`Mutation failed: ${result.error?.message ?? "unknown"}`);
  }
  const { error } = await supabase.from("audit_log").insert({
    user_id: ctx.id,
    user_email: ctx.email,
    action,
    resource_type: meta.resourceType ?? null,
    resource_id: meta.resourceId ?? null,
    metadata: meta.payload ?? null,
  });
  if (error) throw new Error(`audit insert failed: ${error.message}`);
  return result;
}

async function main() {
  const stamp = new Date().toISOString();

  console.log("1) Portfolio — insert upload_log...");
  await withAudit(
    "portfolio.upload_log.create",
    { resourceType: "upload_log", payload: { test: true, stamp } },
    () =>
      supabase.from("upload_logs").insert({
        archivo: `audit-test-portfolio-${stamp}.xlsx`,
        num_proyectos: 0,
        estado: "audit_test",
        duracion_ms: 1,
        detalle: { verify: "audit" },
      }),
  );

  console.log("2) PM — insert pm_import_logs...");
  await withAudit(
    "pm.import_log.create",
    { resourceType: "import_log", payload: { test: true, stamp } },
    () =>
      supabase.from("pm_import_logs").insert({
        archivo: `audit-test-pm-${stamp}.xlsb`,
        estado: "audit_test",
        duracion_ms: 1,
        detalle: { verify: "audit" },
      }),
  );

  console.log("3) Monday — insert monday_sync_logs...");
  const { data: mondayRow, error: mondayErr } = await withAudit(
    "monday.sync_log.create",
    { resourceType: "sync_log" },
    () =>
      supabase
        .from("monday_sync_logs")
        .insert({
          fecha: stamp,
          estado: "audit_test",
          duracion_ms: 0,
          boards_sincronizados: 0,
          items_sincronizados: 0,
          errores: 0,
          detalle: { verify: "audit" },
        })
        .select("id")
        .single(),
  );
  if (mondayErr) throw mondayErr;

  const syncId = mondayRow?.id;
  if (syncId) {
    console.log("4) Monday — update monday_sync_logs...");
    await withAudit(
      "monday.sync_log.update",
      { resourceType: "sync_log", resourceId: syncId, payload: { estado: "completado" } },
      () =>
        supabase
          .from("monday_sync_logs")
          .update({ estado: "completado", duracion_ms: 2 })
          .eq("id", syncId),
    );
  }

  const { data: rows, error: listErr } = await supabase
    .from("audit_log")
    .select("user_id, action, resource_type, metadata, created_at")
    .eq("user_id", "mock-admin")
    .order("created_at", { ascending: false })
    .limit(10);

  if (listErr) {
    console.error("No se pudo leer audit_log:", listErr.message);
    console.error("¿Aplicaste supabase/migrations/20260521110000_audit_log.sql?");
    process.exit(1);
  }

  console.log("\nÚltimas entradas audit_log (mock-admin):");
  console.table(rows ?? []);
  const expected = [
    "portfolio.upload_log.create",
    "pm.import_log.create",
    "monday.sync_log.create",
    "monday.sync_log.update",
  ];
  const actions = new Set((rows ?? []).map((r) => r.action));
  const missing = expected.filter((a) => !actions.has(a));
  if (missing.length) {
    console.warn("Acciones no vistas en las últimas 10 filas (puede haber más histórico):", missing);
  } else {
    console.log("\nOK: las cuatro acciones de prueba aparecen en audit_log.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
