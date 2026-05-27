import { normalizeKey } from "../actas/lib/normalize";
import {
  ZONE_KEYS,
  ZONE_ROLES,
  type ZoneKey,
  type ZoneRole,
} from "./lib/constants";
import { createActasServerClient, loadActasEnv } from "./lib/supabase";

loadActasEnv();

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

function parseArgs(): { email: string; zone: string; role: string } {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  if (args.length !== 3) {
    console.error(
      "Uso: npm run auth:grant -- <email> <zona> <rol>\n" +
        "  zona: financiero | pm | adquisiciones | data\n" +
        "  rol:  admin | editor | lector | none (revoca acceso a la zona)",
    );
    process.exit(1);
  }
  return { email: args[0]!, zone: args[1]!, role: args[2]! };
}

function isZoneKey(value: string): value is ZoneKey {
  return (ZONE_KEYS as readonly string[]).includes(value);
}

function isZoneRole(value: string): value is ZoneRole {
  return (ZONE_ROLES as readonly string[]).includes(value);
}

async function main(): Promise<void> {
  const { email, zone, role } = parseArgs();

  if (!isZoneKey(zone)) {
    console.error(
      `Zona inválida: "${zone}". Válidas: ${ZONE_KEYS.join(", ")}`,
    );
    process.exit(1);
  }

  if (role !== "none" && !isZoneRole(role)) {
    console.error(
      `Rol inválido: "${role}". Válidos: ${ZONE_ROLES.join(", ")}, none`,
    );
    process.exit(1);
  }

  const admin = createActasServerClient();
  const userId = await findAuthUserIdByEmail(admin, email);

  if (!userId) {
    console.error(`No existe usuario en auth.users con email: ${email}`);
    process.exit(1);
  }

  if (role === "none") {
    const { error } = await admin
      .from("app_user_zone_role")
      .delete()
      .eq("user_id", userId)
      .eq("zone_key", zone);

    if (error) {
      console.error(`Error al revocar: ${error.message}`);
      process.exit(1);
    }

    console.log(`Revocado: ${email} ya no tiene acceso a zona "${zone}".`);
    return;
  }

  const { error } = await admin.from("app_user_zone_role").upsert(
    {
      user_id: userId,
      zone_key: zone,
      role,
    },
    { onConflict: "user_id,zone_key" },
  );

  if (error) {
    console.error(`Error al asignar rol: ${error.message}`);
    process.exit(1);
  }

  console.log(`OK: ${email} → zona "${zone}" con rol "${role}" (${userId}).`);
}

void main();
