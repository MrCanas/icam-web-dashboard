import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get("icam-auth");
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");
  const isPublicAuthApi =
    pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/logout");
  const isProtectedDataApi =
    pathname.startsWith("/api/upload-excel") ||
    pathname.startsWith("/api/upload-logs") ||
    pathname.startsWith("/api/replace-proyectos-status");

  if (isApiRoute && !isPublicAuthApi) {
    if (isProtectedDataApi && authCookie?.value !== "authenticated") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isAuthenticated = authCookie?.value === "authenticated";

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isLoginPage) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-icam.png).*)"],
};
