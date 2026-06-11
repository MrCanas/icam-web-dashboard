import { NextResponse } from "next/server";

import { issueSupabaseTokenForIcamSession } from "@/lib/auth/issue-supabase-token";

/**
 * Bridge ICAM → Supabase: cookie `icam-auth` ya validada → JWT `authenticated`
 * para que el navegador consulte PostgREST con RLS (`auth.uid()`).
 *
 * No firmamos JWTs a mano. Usamos admin.generateLink + verifyOtp para que
 * GoTrue emita la sesión con las claves del proyecto (ECC P-256 / HS256 legacy),
 * sin necesitar acceso a la clave privada ni a SUPABASE_JWT_SECRET.
 */
export async function GET() {
  const result = await issueSupabaseTokenForIcamSession();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    access_token: result.access_token,
    expires_at: result.expires_at,
  });
}
