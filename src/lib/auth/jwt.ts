import { SignJWT, jwtVerify } from "jose";

const ALGORITHM = "HS256";

function getJwtSecret(): Uint8Array {
  const raw = process.env.AUTH_JWT_SECRET?.trim();
  if (!raw || raw.length < 32) {
    throw new Error(
      "AUTH_JWT_SECRET debe estar definido en .env.local (mínimo 32 caracteres).",
    );
  }
  return new TextEncoder().encode(raw);
}

/**
 * Firma el JWT de sesión del portal (cookie icam-auth).
 * `sub` = auth.users.id
 */
export async function signSessionToken(
  userId: string,
  expiresIn: string | number = "7d",
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<{ user_id: string } | null> {
  if (!token || token === "authenticated") {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: [ALGORITHM],
    });
    const user_id = typeof payload.sub === "string" ? payload.sub : null;
    if (!user_id) return null;
    return { user_id };
  } catch {
    return null;
  }
}
