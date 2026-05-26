"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let cached:
  | { accessToken: string; expiresAtMs: number }
  | null = null;
let inflight: Promise<string> | null = null;

function getPublicConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

function tokenStillValid(expiresAtMs: number): boolean {
  return expiresAtMs - Date.now() > REFRESH_MARGIN_MS;
}

/**
 * Obtiene (o reutiliza) el JWT del bridge `/api/auth/supabase-token`.
 * Re-fetch si faltan menos de 5 minutos para `expires_at`.
 */
export async function fetchSupabaseBridgeToken(): Promise<string> {
  if (cached && tokenStillValid(cached.expiresAtMs)) {
    return cached.accessToken;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    const res = await fetch("/api/auth/supabase-token", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(
        body.error ??
          `No se pudo obtener token Supabase (${res.status})`,
      );
    }
    const data = (await res.json()) as {
      access_token: string;
      expires_at: string;
    };
    const expiresAtMs = new Date(data.expires_at).getTime();
    cached = { accessToken: data.access_token, expiresAtMs };
    return data.access_token;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Limpia caché (p. ej. tras logout ICAM). */
export function clearSupabaseBridgeTokenCache(): void {
  cached = null;
  inflight = null;
}

let browserClient: SupabaseClient | null = null;

/**
 * Cliente Supabase para el navegador: anon key + `Authorization: Bearer <JWT bridge>`.
 * RLS aplica con `auth.uid()` del usuario ICAM logueado.
 */
export function createBrowserSupabaseClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getPublicConfig();

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        const token = await fetchSupabaseBridgeToken();
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
  });

  return browserClient;
}
