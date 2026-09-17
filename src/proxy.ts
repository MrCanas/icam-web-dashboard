import { NextRequest, NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_RENEW_BELOW_S,
  signSessionToken,
  verifySessionToken,
} from "@/lib/auth/jwt";

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? "",
  );
  const isAuthenticated = session !== null;
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isApiRoute = pathname.startsWith("/api/");
  const isProtectedDataApi =
    pathname.startsWith("/api/upload-excel") ||
    pathname.startsWith("/api/upload-pm-excel") ||
    pathname.startsWith("/api/upload-logs") ||
    pathname.startsWith("/api/replace-proyectos-status") ||
    pathname.startsWith("/api/replace-pm-portfolio-status") ||
    pathname.startsWith("/api/monday") ||
    pathname.startsWith("/api/actas");
  // Las Server Actions son POST a la URL de la página con esta cabecera.
  const isServerAction =
    request.method === "POST" && request.headers.has("next-action");

  if (isApiRoute) {
    if (isProtectedDataApi && !isAuthenticated) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    // Login y logout gestionan la cookie ellos mismos: renovarla aquí podría
    // pisar la cookie vacía del logout.
    if (pathname.startsWith("/api/auth/")) return NextResponse.next();
    return withRenewedSession(NextResponse.next(), session);
  }

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard/portfolio", request.url));
  }

  if (isLoginPage) {
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    // Una Server Action no puede seguir un 307: el navegador acababa
    // recibiendo el HTML de /login y el cliente fallaba con «An unexpected
    // response was received from the server». Con x-action-redirect, Next
    // hace él mismo la navegación a /login.
    if (isServerAction) {
      return new NextResponse(null, {
        status: 200,
        headers: { "x-action-redirect": "/login", "content-type": "text/plain" },
      });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return withRenewedSession(NextResponse.next(), session);
}

/**
 * Sesión deslizante: si a la sesión le quedan menos de SESSION_RENEW_BELOW_S,
 * se emite otra de 7 días. Solo alarga la cookie: el acceso (cuenta activa,
 * roles) se sigue comprobando en cada petición en loadUserContext.
 */
async function withRenewedSession(
  response: NextResponse,
  session: Awaited<ReturnType<typeof verifySessionToken>>,
): Promise<NextResponse> {
  if (!session?.exp) return response;
  const remainingS = session.exp - Math.floor(Date.now() / 1000);
  if (remainingS >= SESSION_RENEW_BELOW_S) return response;
  try {
    const token = await signSessionToken(session.user_id);
    response.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  } catch (err) {
    // Sin renovar, la sesión actual sigue valiendo hasta su caducidad.
    console.error("[proxy] renovar sesión", err);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo-icam.png).*)"],
};
