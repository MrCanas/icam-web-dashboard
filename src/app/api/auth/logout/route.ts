import { NextRequest, NextResponse } from "next/server";

function clearAuthCookie(response: NextResponse) {
  response.cookies.set("icam-auth", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

// Solo POST: un GET destructivo se dispara con un <img src="/api/auth/logout">
// de terceros (CSRF de logout). Los dos únicos llamadores ya usan POST.
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  return clearAuthCookie(response);
}
