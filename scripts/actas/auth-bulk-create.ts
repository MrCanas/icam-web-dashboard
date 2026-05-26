import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { loadActasEnv } from "./lib/env";
import { createActasServerClient } from "./lib/supabase-server";
import { normalizeKey } from "./lib/normalize";
import {
  runMondayUserMapping,
  USER_MAPPING_OUTPUT,
  type UserMappingEntry,
} from "./lib/user-mapping";

loadActasEnv();

interface UserMappingFile {
  unmapped_monday_users?: UserMappingEntry[];
  users?: UserMappingEntry[];
}

function randomPassword(length = 32): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i]! % chars.length];
  }
  return out;
}

function loadUnmappedFromJson(): UserMappingEntry[] {
  const raw = readFileSync(USER_MAPPING_OUTPUT, "utf8");
  const doc = JSON.parse(raw) as UserMappingFile;
  const fromSection = doc.unmapped_monday_users ?? [];
  const fromUsers = (doc.users ?? []).filter((u) => u.unmapped);
  const byId = new Map<string, UserMappingEntry>();
  for (const u of [...fromSection, ...fromUsers]) {
    byId.set(u.monday_user_id, u);
  }
  return [...byId.values()];
}

function isAlreadyRegisteredError(message: string): boolean {
  return /already|registered|exists|duplicate/i.test(message);
}

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

async function main(): Promise<void> {
  const admin = createActasServerClient();
  const unmapped = loadUnmappedFromJson();

  console.log(`Unmapped en ${USER_MAPPING_OUTPUT}: ${unmapped.length}\n`);

  const created: { email: string; userId: string; monday_user_id: string }[] =
    [];
  const existing: { email: string; userId: string; monday_user_id: string }[] =
    [];
  const failed: { email: string | null; monday_user_id: string; reason: string }[] =
    [];
  const skippedNoEmail: UserMappingEntry[] = [];

  const seenEmails = new Set<string>();

  for (const entry of unmapped) {
    const email = entry.monday_email?.trim();
    if (!email) {
      skippedNoEmail.push(entry);
      failed.push({
        email: null,
        monday_user_id: entry.monday_user_id,
        reason: "Sin email en Monday",
      });
      continue;
    }

    const emailKey = normalizeKey(email);
    if (seenEmails.has(emailKey)) {
      existing.push({
        email,
        userId: "(dedupe en lote)",
        monday_user_id: entry.monday_user_id,
      });
      continue;
    }
    seenEmails.add(emailKey);

    let userId = await findAuthUserIdByEmail(admin, email);
    if (userId) {
      existing.push({ email, userId, monday_user_id: entry.monday_user_id });
      console.log(`  existe  ${email}`);
      continue;
    }

    const password = randomPassword(32);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (isAlreadyRegisteredError(error.message)) {
        userId = await findAuthUserIdByEmail(admin, email);
        if (userId) {
          existing.push({ email, userId, monday_user_id: entry.monday_user_id });
          console.log(`  existe  ${email} (tras race)`);
          continue;
        }
      }
      failed.push({
        email,
        monday_user_id: entry.monday_user_id,
        reason: error.message,
      });
      console.log(`  FALLÓ  ${email}: ${error.message}`);
      continue;
    }

    if (!data.user?.id) {
      failed.push({
        email,
        monday_user_id: entry.monday_user_id,
        reason: "createUser sin user.id en respuesta",
      });
      continue;
    }

    created.push({
      email,
      userId: data.user.id,
      monday_user_id: entry.monday_user_id,
    });
    console.log(`  creado  ${email}`);
  }

  console.log("\nRe-ejecutando mapeo Monday → Supabase…");
  const payload = await runMondayUserMapping({ log: true });

  console.log("\n--- Resumen auth-bulk-create ---");
  console.log(`Creados:        ${created.length}`);
  console.log(`Ya existentes:  ${existing.length}`);
  console.log(`Fallidos:       ${failed.length}`);
  if (skippedNoEmail.length) {
    console.log(`Sin email:      ${skippedNoEmail.length}`);
  }
  console.log(
    `\nJSON actualizado — Mapped: ${payload.summary.mapped} · Unmapped: ${payload.summary.unmapped}`,
  );

  if (failed.length) {
    console.log("\nFallidos:");
    for (const f of failed) {
      console.log(`  - ${f.email ?? "(sin email)"} [${f.monday_user_id}]: ${f.reason}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
