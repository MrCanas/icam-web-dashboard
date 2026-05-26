import { createActasServerClient } from "./lib/supabase-server";

const TABLES = [
  "master_group",
  "master_element",
  "master_module",
  "master_element_module",
] as const;

async function main(): Promise<void> {
  const supabase = createActasServerClient();

  for (const table of TABLES) {
    const { error } = await supabase.from(table).select("*").limit(0);
    if (error) {
      console.error(`[${table}] ${error.message}`);
      process.exit(1);
    }
    console.log(`[${table}] OK`);
  }

  console.log("\nCatálogo maestro: tablas accesibles.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
