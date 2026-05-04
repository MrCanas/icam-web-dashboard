import type { NextRequest } from "next/server";

export function isIcamAuthenticated(request: NextRequest): boolean {
  return request.cookies.get("icam-auth")?.value === "authenticated";
}
