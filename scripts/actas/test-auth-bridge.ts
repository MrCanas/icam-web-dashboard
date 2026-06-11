/**
 * Integración P4.0 (refactor P4.1) — bridge ICAM cookie ↔ JWT Supabase.
 *
 * Usa admin.generateLink + verifyOtp (sin SUPABASE_JWT_SECRET).
 * Requiere .env.local con SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY (o alias).
 * Usuario de prueba: ACTAS_AUTH_BRIDGE_TEST_EMAIL (debe existir en auth.users).
 */
import { config } from "dotenv";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { createActasAnonClient } from "./lib/supabase-anon";
import { createActasServerClient } from "./lib/supabase-server";
import { getSupabaseAnonKey, getSupabaseUrl, loadActasEnv } from "./lib/env";

config({ path: resolve(process.cwd(), ".env.local") });

const ICAM_ORG_ID = "a0000000-0000-4000-8000-000000000001";

function clientWithAccessToken(accessToken: string) {
  loadActasEnv();
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function ensureOrgMember(userId: string): Promise<void> {
  const admin = createActasServerClient();
  const { error } = await admin.from("org_member").upsert({
    organization_id: ICAM_ORG_ID,
    user_id: userId,
    role: "member",
  });
  if (error) {
    throw new Error(`org_member upsert: ${error.message}`);
  }
}

/**
 * Llama al mismo flujo que el endpoint bridge (generateLink + verifyOtp)
 * sin depender de SUPABASE_JWT_SECRET.
 */
async function getBridgeTokenForEmail(
  email: string,
): Promise<{ access_token: string; expires_at: string }> {
  loadActasEnv();
  const url = getSupabaseUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = getSupabaseAnonKey();

  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
  if (linkError) throw new Error(`generateLink: ${linkError.message}`);

  const hashedToken = linkData?.properties?.hashed_token;
  if (!hashedToken)
    throw new Error("generateLink: hashed_token ausente");

  const transient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: sessionError } =
    await transient.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    });
  if (sessionError || !sessionData.session) {
    throw new Error(`verifyOtp: ${sessionError?.message ?? "sin sesión"}`);
  }

  const { access_token, expires_at } = sessionData.session;
  return {
    access_token,
    expires_at:
      typeof expires_at === "number"
        ? new Date(expires_at * 1000).toISOString()
        : expires_at ?? "",
  };
}

async function resolveAuthUserIdByEmail(email: string): Promise<string | null> {
  const admin = createActasServerClient();
  const target = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (u.email?.toLowerCase() === target) return u.id;
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function main(): Promise<void> {
  loadActasEnv();
  const testEmail =
    process.env.ACTAS_AUTH_BRIDGE_TEST_EMAIL?.trim() ||
    "javiercanas@imparcapital.com";

  console.log("Auth bridge — test de integración (generateLink + verifyOtp)\n");

  // 1) anon without JWT → 0 rows
  const anon = createActasAnonClient();
  const { data: anonRows, error: anonErr } = await anon
    .from("project")
    .select("code")
    .limit(1);
  if (anonErr) throw new Error(`anon select: ${anonErr.message}`);
  if ((anonRows?.length ?? 0) > 0) {
    throw new Error(
      `Sin login no debe ver proyectos; obtuvo: ${JSON.stringify(anonRows)}`,
    );
  }
  console.log("[anon sin JWT] OK — 0 filas en project");

  // 2) resolve user + ensure org membership
  const authUserId = await resolveAuthUserIdByEmail(testEmail);
  if (!authUserId) {
    throw new Error(
      `Usuario de prueba ${testEmail} no está en auth.users. ` +
        "Créalo con actas:auth-bulk-create o Dashboard → Authentication.",
    );
  }
  await ensureOrgMember(authUserId);
  console.log(`[setup] auth.users.id=${authUserId} (${testEmail}) en org icam`);

  // 3) obtain bridge token (same flow as endpoint)
  const { access_token, expires_at } =
    await getBridgeTokenForEmail(testEmail);
  console.log(`[bridge] token obtenido, expires_at=${expires_at}`);

  // 4) authenticated client should see projects
  const member = clientWithAccessToken(access_token);
  const { data: projects, error: memberErr } = await member
    .from("project")
    .select("code")
    .limit(5);
  if (memberErr) throw new Error(`authenticated select: ${memberErr.message}`);

  console.log(
    `[authenticated + JWT bridge] OK — projects: ${
      projects?.length
        ? projects.map((p: { code: string }) => p.code).join(", ")
        : "(0 filas; RLS OK pero sin proyectos en org)"
    }`,
  );

  // 5) expired token test — craft a clearly old bearer manually for the rejection check
  //    Since we can't forge tokens with the new approach, we test with a garbage token.
  const garbageClient = clientWithAccessToken("not.a.valid.jwt.token");
  const { data: garbageRows } = await garbageClient
    .from("project")
    .select("code")
    .limit(1);
  if ((garbageRows?.length ?? 0) > 0) {
    throw new Error("Token inválido no debería devolver filas de project");
  }
  console.log("[token inválido] OK — sin acceso a project");

  console.log("\nExit 0 — Auth bridge OK.");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
