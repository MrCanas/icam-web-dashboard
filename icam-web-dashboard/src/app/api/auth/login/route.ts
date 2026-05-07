import { NextRequest, NextResponse } from "next/server";

const VALID_USER = "ImparCapital";
const VALID_PASS = "Capital2030";

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (username === VALID_USER && password === VALID_PASS) {
    const response = NextResponse.json({ success: true });
    response.cookies.set("icam-auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return response;
  }

  return NextResponse.json({ success: false }, { status: 401 });
}
