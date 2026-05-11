import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get("icam-auth");
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");
  const isProtectedDataApi =
    pathname.startsWith("/api/upload-excel") ||
    pathname.startsWith("/api/upload-pm-excel") ||
    pathname.startsWith("/api/upload-logs") ||
    pathname.startsWith("/api/replace-proyectos-status") ||
    pathname.startsWith("/api/replace-pm-portfolio-status") ||
    pathname.startsWith("/api/monday");

  if (isApiRoute) {
    if (isProtectedDataApi && authCookie?.value !== "authenticated") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isAuthenticated = authCookie?.value === "authenticated";

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard/portfolio", request.url));
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

