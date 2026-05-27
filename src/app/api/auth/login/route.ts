import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";

import { signSessionToken } from "@/lib/auth/jwt";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { createServiceRoleClient } from "@/lib/db/admin";

const GENERIC_AUTH_ERROR = "Email o contraseña incorrectos";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 7,
  path: "/",
};

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  const email = (body.email ?? body.username)?.trim();
  const password = body.password;

  if (!email || typeof password !== "string" || !password) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  let userId: string | null;
  try {
    userId = await resolveAuthUserIdByEmail(email);
  } catch {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: passwordRow, error: passwordError } = await admin
    .from("app_user_password")
    .select("password_hash")
    .eq("user_id", userId)
    .maybeSingle();

  if (passwordError || !passwordRow?.password_hash) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  const passwordMatch = await bcrypt.compare(
    password,
    passwordRow.password_hash,
  );

  if (!passwordMatch) {
    return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }

  let token: string;
  try {
    token = await signSessionToken(userId);
  } catch (err) {
    console.error("[auth/login] signSessionToken failed", err);
    return NextResponse.json(
      { error: "Error de configuración de sesión" },
      { status: 500 },
    );
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("icam-auth", token, COOKIE_OPTIONS);
  return response;
}
