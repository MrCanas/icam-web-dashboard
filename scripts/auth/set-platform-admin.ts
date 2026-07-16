import { normalizeKey } from "../actas/lib/normalize";
import { createActasServerClient, loadActasEnv } from "./lib/supabase";

loadActasEnv();

/**
 * Red de seguridad del bootstrap: concede o revoca el flag de admin de
 * plataforma sin pasar por la UI. A propósito NO aplica el guardrail de
 * "debe quedar al menos un admin" — es la salida de emergencia.
 */

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createActasServerClient>,
  email: string,
): Promise<string | null> {
  const key = normalizeKey(email);
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      if (u.email && normalizeKey(u.email) === key) return u.id;
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}

function parseArgs(): { email: string; value: boolean } {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  if (args.length !== 2 || (args[1] !== "on" && args[1] !== "off")) {
    console.error(
      "Uso: npm run auth:platform-admin -- <email> <on|off>\n" +
        "  on  → concede admin de plataforma (puede gestionar usuarios)\n" +
        "  off → revoca admin de plataforma",
    );
    process.exit(1);
  }
  return { email: args[0]!, value: args[1] === "on" };
}

async function main(): Promise<void> {
  const { email, value } = parseArgs();

  const admin = createActasServerClient();
  const userId = await findAuthUserIdByEmail(admin, email);

  if (!userId) {
    console.error(`No existe usuario en auth.users con email: ${email}`);
    process.exit(1);
  }

  const { error } = await admin.from("app_user_account").upsert(
    {
      user_id: userId,
      is_platform_admin: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error(`Error al actualizar app_user_account: ${error.message}`);
    process.exit(1);
  }

  console.log(
    value
      ? `OK: ${email} es admin de plataforma (${userId}).`
      : `OK: ${email} ya no es admin de plataforma (${userId}).`,
  );
}

void main();
