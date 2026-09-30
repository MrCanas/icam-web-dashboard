import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type BrowserContext } from "playwright-core";

import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth/jwt";

/**
 * Navegador para las comprobaciones automáticas (paridad de slides, recorrido
 * del informe): Microsoft Edge instalado en el equipo, en headless, con
 * playwright-core (no descarga navegadores). Los clics de la extensión de
 * Chrome no llegan en este equipo; esto sí.
 */
export async function abrirEdge(): Promise<Browser> {
  return chromium.launch({ channel: "msedge", headless: true });
}

/** id de auth.users para un email (service role). */
export async function idUsuario(email: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, clave, { auth: { persistSession: false } });
  for (let page = 1; page < 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 200) break;
  }
  throw new Error(`No existe el usuario ${email}`);
}

/** Contexto con la cookie de sesión del portal firmada para `email` (solo contra un servidor local). */
export async function contextoConSesion(navegador: Browser, baseUrl: string, email: string): Promise<BrowserContext> {
  const host = new URL(baseUrl).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("Las sesiones firmadas solo se usan contra un servidor local");
  }
  const token = await signSessionToken(await idUsuario(email), "2h");
  const ctx = await navegador.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
  await ctx.addCookies([{ name: SESSION_COOKIE_NAME, value: token, domain: host, path: "/", httpOnly: true }]);
  return ctx;
}
