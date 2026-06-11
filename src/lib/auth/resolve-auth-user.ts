import { createServiceRoleClient } from "@/lib/db/admin";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resuelve `auth.users.id` por email (service role). Pagina listUsers.
 */
export async function resolveAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  const admin = createServiceRoleClient();
  const target = normalizeEmail(email);
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`listUsers: ${error.message}`);
    }
    for (const user of data.users) {
      if (user.email && normalizeEmail(user.email) === target) {
        return user.id;
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return null;
}
