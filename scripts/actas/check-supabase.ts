import { createActasAnonClient } from "./lib/supabase-anon";
import { createActasServerClient } from "./lib/supabase-server";

const HEALTH_RPC = "actas_check_supabase_health";

function isMissingRpcError(message: string): boolean {
  return (
    message.includes("Could not find the function") ||
    message.includes("PGRST202")
  );
}

async function fallbackServerTime(
  supabase: ReturnType<typeof createActasServerClient>,
): Promise<string | null> {
  const tables = ["audit_log", "proyectos", "pm_activos", "upload_logs"] as const;

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.created_at) {
      return `${data.created_at} (from ${table}.created_at)`;
    }
  }

  return null;
}

async function checkClient(
  label: string,
  createClient: () => ReturnType<typeof createActasServerClient>,
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(HEALTH_RPC);

  if (!error) {
    console.log(`[${label}] OK — server time (now()): ${data}`);
    return;
  }

  if (isMissingRpcError(error.message)) {
    const fallback = await fallbackServerTime(supabase);
    if (fallback) {
      console.log(`[${label}] OK — server time (fallback): ${fallback}`);
      console.warn(
        `[${label}] Aplica la migración actas_health_rpc para usar now(): npx supabase link && npx supabase db push`,
      );
      return;
    }
  }

  console.error(`[${label}] Error: ${error.message}`);
  if (isMissingRpcError(error.message)) {
    console.error(
      "  Aplica migraciones: npx supabase link --project-ref <ref> && npx supabase db push",
    );
    console.error(
      "  O ejecuta supabase/migrations/20260521120000_actas_health_rpc.sql en el SQL Editor.",
    );
  }
  process.exitCode = 1;
}

async function main(): Promise<void> {
  console.log("Comprobando conexión Supabase (RPC actas_check_supabase_health → now())…\n");

  await checkClient("service_role", createActasServerClient);
  await checkClient("anon", createActasAnonClient);

  if (process.exitCode === 1) {
    console.error("\nFallo la comprobación. Revisa .env.local (copia desde .env.local.example).");
    process.exit(1);
  }

  console.log("\nConexión Supabase correcta.");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
