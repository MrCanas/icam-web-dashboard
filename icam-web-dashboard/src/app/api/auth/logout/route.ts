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

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  return clearAuthCookie(response);
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  return clearAuthCookie(response);
}
