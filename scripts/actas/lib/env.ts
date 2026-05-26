import { config } from "dotenv";
import { resolve } from "node:path";

let loaded = false;

/** Loads `.env.local` from repo root (idempotent). */
export function loadActasEnv(): void {
  if (loaded) return;
  config({ path: resolve(process.cwd(), ".env.local") });
  loaded = true;
}

export function getSupabaseUrl(): string {
  const url =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "Falta SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL en .env.local",
    );
  }
  return url.replace(/\/$/, "");
}

export function getSupabaseAnonKey(): string {
  const key =
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    throw new Error(
      "Falta SUPABASE_ANON_KEY o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local",
    );
  }
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  return key;
}
