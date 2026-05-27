# ICAM cookie `icam-auth` — anatomy (repo findings)

> Documento generado leyendo el código del repo. No hay suposiciones.

## Dónde se setea la cookie

La cookie `icam-auth` se **genera** en el endpoint:

- `POST /api/auth/login`
- Archivo: `src/app/api/auth/login/route.ts`

En ese handler, si las credenciales coinciden, se setea:

```9:18:src/app/api/auth/login/route.ts
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
```

Y se **borra** (logout) en:

- `POST /api/auth/logout` y `GET /api/auth/logout`
- Archivo: `src/app/api/auth/logout/route.ts`

```3:11:src/app/api/auth/logout/route.ts
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
```

## Qué contenido lleva `icam-auth`

El contenido es un **string fijo**:

- **Valor**: `"authenticated"`
- **Tipo**: token opaco (no JWT)
- **Payload**: ninguno (no contiene claims, ni email, ni id)

Se ve explícitamente en el set de cookie:

```11:17:src/app/api/auth/login/route.ts
    response.cookies.set("icam-auth", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
```

## Cómo se valida `icam-auth` (y qué devuelve)

La validación es local por **comparación literal** (no hay verificación criptográfica ni llamada a un backend ICAM):

```18:25:src/lib/auth/currentUser.ts
export function isSessionAuthenticated(request: NextRequest): boolean {
  return request.cookies.get("icam-auth")?.value === "authenticated";
}

async function isServerSessionAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("icam-auth")?.value === "authenticated";
}
```

Efectos de esa validación:

- **Middleware/gate de rutas**: `src/proxy.ts` redirige a `/login` si no hay cookie válida y protege un subset de APIs.

```4:36:src/proxy.ts
export function proxy(request: NextRequest) {
  const isAuthenticated = isSessionAuthenticated(request);
  // ...
  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
```

- **Identidad en servidor**: `getCurrentUser()` devuelve un `UserContext` **mock** si la cookie está presente.

```28:34:src/lib/auth/currentUser.ts
export async function getCurrentUser(): Promise<UserContext | null> {
  if (!(await isServerSessionAuthenticated())) {
    return null;
  }
  // TODO: replace mock with Entra ID / SSO
  return MOCK_USER;
}
```

El usuario mock está hardcodeado:

```11:16:src/lib/auth/currentUser.ts
const MOCK_USER: UserContext = {
  id: "mock-admin",
  email: "admin@icam.es",
  name: "Admin Mock",
  roles: ["admin"],
};
```

## ¿Es JWT? ¿Con qué clave/algoritmo? ¿Qué claims?

`icam-auth` **no es JWT** en este repo (es un string fijo), así que:

- **No hay** algoritmo/clave de firmado asociados a `icam-auth`.
- **No hay** claims (`sub`, `email`, etc.) dentro de `icam-auth`.

## Si es token opaco: ¿contra qué servicio se valida?

En el estado actual del repo:

- `icam-auth` **no se valida contra ningún servicio externo**.
- Se considera “válida” únicamente si su valor es exactamente `"authenticated"`.

## Endpoint “quién soy” usado por el cliente

El cliente (React) puede pedir identidad al servidor vía:

- `GET /api/me`
- Archivo: `src/app/api/me/route.ts`

Este endpoint llama a `getCurrentUser()` y devuelve 401 si no hay sesión:

```4:10:src/app/api/me/route.ts
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(user);
}
```

## ¿Existe un “cliente backend ICAM” para resolver token → usuario real?

No hay, en el código revisado, un cliente/SDK/fetcher hacia un backend ICAM que:

- reciba `icam-auth`,
- lo valide contra un servicio externo,
- y devuelva un usuario real.

La identidad “real” hoy no se resuelve: `getCurrentUser()` devuelve `MOCK_USER` mientras exista la cookie.

## Nota importante: sí existe un bridge a Supabase (pero es OTRO token)

Hay un endpoint que emite un **JWT de Supabase Auth** para aplicar RLS en el navegador:

- `GET /api/auth/supabase-token`
- Archivo: `src/app/api/auth/supabase-token/route.ts`

Ese endpoint **no** setea `icam-auth`. Solo usa `icam-auth` como “gate” (vía `getCurrentUser()`) y luego llama a Supabase Auth (`admin.generateLink` + `verifyOtp`) para que **GoTrue** emita un `access_token`:

```13:26:src/app/api/auth/supabase-token/route.ts
export async function GET() {
  const result = await issueSupabaseTokenForIcamSession();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    access_token: result.access_token,
    expires_at: result.expires_at,
  });
}
```

La implementación está en `src/lib/auth/issue-supabase-token.ts`. Importante:

- El JWT lo firma **GoTrue/Supabase**, no este repo.
- El comentario en el archivo indica “ECC P-256 / HS256 legacy” según configuración del proyecto Supabase, pero el repo **no** contiene claves ni claims explícitos para ese JWT (solo obtiene `access_token` devuelto por GoTrue).

Para contexto adicional (documentación interna del repo): `docs/actas/13-auth-bridge.md`.

