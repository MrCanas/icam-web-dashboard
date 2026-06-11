import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { createServiceRoleClient } from "@/lib/db/admin";

const GENERIC_ERROR = "Contraseña actual incorrecta";
const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida" }, { status: 400 });
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;

  if (
    typeof currentPassword !== "string" ||
    !currentPassword ||
    typeof newPassword !== "string" ||
    !newPassword
  ) {
    return NextResponse.json(
      { error: "Contraseña actual y nueva son obligatorias" },
      { status: 400 },
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const { data: row, error: readError } = await admin
    .from("app_user_password")
    .select("password_hash")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError || !row?.password_hash) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const matches = await bcrypt.compare(currentPassword, row.password_hash);
  if (!matches) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await admin
    .from("app_user_password")
    .update({
      password_hash,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json(
      { error: "No se pudo actualizar la contraseña" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
