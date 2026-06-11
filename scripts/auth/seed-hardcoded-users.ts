import bcrypt from "bcrypt";

import {
  BCRYPT_ROUNDS,
  INITIAL_PORTAL_PASSWORD,
  ZONE_KEYS,
} from "./lib/constants";
import {
  loadUserMappingFile,
  partitionImparCapitalUsers,
} from "./lib/mapping";
import { createActasServerClient, loadActasEnv } from "./lib/supabase";

loadActasEnv();

async function upsertPasswordIfInitial(
  admin: ReturnType<typeof createActasServerClient>,
  userId: string,
  initialHash: string,
): Promise<"inserted" | "skipped_custom" | "unchanged"> {
  const { data: existing, error: readError } = await admin
    .from("app_user_password")
    .select("password_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    throw new Error(`app_user_password read: ${readError.message}`);
  }

  if (existing?.password_hash) {
    const matchesInitial = await bcrypt.compare(
      INITIAL_PORTAL_PASSWORD,
      existing.password_hash,
    );
    if (!matchesInitial) {
      return "skipped_custom";
    }
    return "unchanged";
  }

  const { error: upsertError } = await admin.from("app_user_password").upsert(
    {
      user_id: userId,
      password_hash: initialHash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    throw new Error(`app_user_password upsert: ${upsertError.message}`);
  }

  return "inserted";
}

async function upsertZoneRolesAdmin(
  admin: ReturnType<typeof createActasServerClient>,
  userId: string,
): Promise<void> {
  const rows = ZONE_KEYS.map((zone_key) => ({
    user_id: userId,
    zone_key,
    role: "admin" as const,
  }));

  const { error } = await admin
    .from("app_user_zone_role")
    .upsert(rows, { onConflict: "user_id,zone_key" });

  if (error) {
    throw new Error(`app_user_zone_role upsert: ${error.message}`);
  }
}

async function main(): Promise<void> {
  const doc = loadUserMappingFile();
  const { candidates, excluded } = partitionImparCapitalUsers(doc);
  const admin = createActasServerClient();
  const initialHash = await bcrypt.hash(INITIAL_PORTAL_PASSWORD, BCRYPT_ROUNDS);

  const processedEmails: string[] = [];
  const failures: { email: string; reason: string }[] = [];
  let passwordsInserted = 0;
  let passwordsSkippedCustom = 0;

  console.log(`Mapping: docs/actas/06-user-mapping.json`);
  console.log(`Candidatos @imparcapital.com con supabase_user_id: ${candidates.length}\n`);

  for (const { email, userId } of candidates) {
    try {
      const pwdResult = await upsertPasswordIfInitial(admin, userId, initialHash);
      if (pwdResult === "inserted") passwordsInserted += 1;
      if (pwdResult === "skipped_custom") passwordsSkippedCustom += 1;

      await upsertZoneRolesAdmin(admin, userId);
      processedEmails.push(email);
      console.log(`  ok  ${email} (${userId}) [password: ${pwdResult}]`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ email, reason });
      console.error(`  FAIL  ${email}: ${reason}`);
    }
  }

  console.log("\n--- Resumen seed hardcoded ---");
  console.log(`Usuarios procesados: ${processedEmails.length}`);
  console.log(`Contraseñas insertadas (nuevas): ${passwordsInserted}`);
  console.log(`Contraseñas omitidas (ya distintas de inicial): ${passwordsSkippedCustom}`);
  console.log(`Fallos: ${failures.length}`);

  if (processedEmails.length > 0) {
    console.log("\nEmails provisionados:");
    for (const e of processedEmails) {
      console.log(`  - ${e}`);
    }
  }

  if (excluded.length > 0) {
    console.log(
      `\n@imparcapital.com excluidos del seed (${excluded.length}):`,
    );
    for (const row of excluded) {
      console.log(
        `  - ${row.email}${row.mondayName ? ` (${row.mondayName})` : ""}: ${row.reason}`,
      );
    }
  } else {
    console.log("\n@imparcapital.com excluidos del seed: 0");
  }

  if (failures.length > 0) {
    console.log("\nErrores:");
    for (const f of failures) {
      console.log(`  - ${f.email}: ${f.reason}`);
    }
    process.exitCode = 1;
  }
}

void main();
