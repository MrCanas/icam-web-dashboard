import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export interface UserContext {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

const MOCK_USER: UserContext = {
  id: "mock-admin",
  email: "admin@icam.es",
  name: "Admin Mock",
  roles: ["admin"],
};

export function isSessionAuthenticated(request: NextRequest): boolean {
  return request.cookies.get("icam-auth")?.value === "authenticated";
}

async function isServerSessionAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("icam-auth")?.value === "authenticated";
}

/** SERVER: Server Components, route handlers, server actions. */
export async function getCurrentUser(): Promise<UserContext | null> {
  if (!(await isServerSessionAuthenticated())) {
    return null;
  }
  // TODO: replace mock with Entra ID / SSO
  return MOCK_USER;
}

/** SERVER: same identity as getCurrentUser but requires an active session. */
export async function requireCurrentUser(): Promise<UserContext> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("No autorizado");
  }
  return user;
}
