/**
 * Aplica la migración 014 (tabla actas_attachment) y crea el bucket privado
 * 'actas-attachments' en Supabase Storage. Idempotente y verificado.
 *
 *   npx tsx scripts/actas/apply-migration-014.ts
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { closePgPool, withPgClient } from "./lib/db";

config({ path: resolve(process.cwd(), ".env.local") });

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260611130000_014_actas_attachment.sql",
);

const BUCKET = "actas-attachments";
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
const MAX_BYTES = 10 * 1024 * 1024;

async function main(): Promise<void> {
  // 1) Tabla actas_attachment (DDL idempotente).
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  await withPgClient(async (client) => {
    console.log("aplicando migración 014…");
    await client.query(sql);
    const { rows } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'actas_attachment'
       ) AS exists`,
    );
    console.log(`tabla actas_attachment existe: ${rows[0]?.exists}`);
  });
  await closePgPool();

  // 2) Bucket privado de Storage.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) {
    console.log(`bucket '${BUCKET}' ya existe (public=${existing.public}).`);
  } else {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (createError) {
      throw new Error(`No se pudo crear el bucket: ${createError.message}`);
    }
    console.log(`bucket '${BUCKET}' creado (privado).`);
  }

  // Verificación final.
  const { data: check, error: checkError } = await supabase.storage.getBucket(
    BUCKET,
  );
  if (checkError || !check) {
    throw new Error(`Verificación del bucket falló: ${checkError?.message}`);
  }
  console.log(
    `\n✓ Migración 014 + bucket OK (bucket '${check.name}', público=${check.public}).`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
