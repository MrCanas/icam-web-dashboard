import { createClient } from "@supabase/supabase-js";

import { getCurrentUser } from "@/lib/auth/currentUser";

export type IssueSupabaseTokenResult =
  | { ok: true; access_token: string; expires_at: string }
  | { ok: false; status: 401 | 404 | 500; error: string };

function getConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim();

  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL");
  if (!serviceKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  if (!anonKey)
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_ANON_KEY",
    );

  return { url, serviceKey, anonKey };
}

/**
 * Emite un access_token Supabase para el usuario de la sesión ICAM actual.
 *
 * Flujo (admin API + verifyOtp):
 *   1. Verificar cookie icam-auth → email del usuario.
 *   2. generateLink({ type: 'magiclink', email }) con service_role — genera un
 *      hashed_token sin enviar ningún email (lo consumimos en backend).
 *   3. verifyOtp({ token_hash, type: 'magiclink' }) con anon key — canjea el
 *      token por una sesión real firmada con las claves actuales del proyecto
 *      (ECC P-256 o HS256 según configuración Supabase). GoTrue firma el JWT;
 *      nosotros nunca tocamos la clave privada.
 *
 * Por qué NO firmamos con HS256 manualmente:
 *   El proyecto usa "JWT Signing Keys" asimétricos (ECC P-256) como current key.
 *   La clave privada no es accesible desde fuera; el approach HS256 con
 *   SUPABASE_JWT_SECRET está deprecated en proyectos con asymmetric signing.
 *
 * Coste: 2 round-trips a Supabase Auth por emisión. La caché de 5 min en el
 *   cliente browser (`supabase-browser.ts`) limita las llamadas a ~12/hora/usuario.
 */
export async function issueSupabaseTokenForIcamSession(): Promise<IssueSupabaseTokenResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  let url: string;
  let serviceKey: string;
  let anonKey: string;
  try {
    ({ url, serviceKey, anonKey } = getConfig());
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Configuración incompleta",
    };
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Step 1: generate a magic link (not sent by email; consumed immediately here)
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });

  if (linkError) {
    return {
      ok: false,
      status: linkError.status === 404 ? 404 : 500,
      error: `generateLink: ${linkError.message}`,
    };
  }

  const hashedToken = linkData?.properties?.hashed_token;
  if (!hashedToken) {
    return {
      ok: false,
      status: 500,
      error: "generateLink: hashed_token ausente en la respuesta",
    };
  }

  // Step 2: exchange hashed_token for a real Supabase session (GoTrue signs JWT)
  const transientClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sessionData, error: sessionError } =
    await transientClient.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    });

  if (sessionError || !sessionData.session) {
    return {
      ok: false,
      status: 500,
      error: `verifyOtp: ${sessionError?.message ?? "sin sesión"}`,
    };
  }

  const { access_token, expires_at } = sessionData.session;

  return {
    ok: true,
    access_token,
    expires_at: typeof expires_at === "number"
      ? new Date(expires_at * 1000).toISOString()
      : expires_at ?? new Date(Date.now() + 3600 * 1000).toISOString(),
  };
}
