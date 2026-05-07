import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIcamAuthenticated } from "@/lib/api-auth";

/** Comprueba si PostgREST expone el RPC replace_pm_portfolio (solo OpenAPI). */
export async function GET(request: NextRequest) {
  if (!isIcamAuthenticated(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json(
      {
        replace_pm_portfolio_visible: false,
        error: "Faltan variables de entorno Supabase (URL o service role).",
      },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        Accept: "application/openapi+json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          replace_pm_portfolio_visible: false,
          error: `No se pudo leer el esquema API (${res.status}).`,
        },
        { status: 502 },
      );
    }

    const doc = (await res.json()) as { paths?: Record<string, unknown> };
    const paths = doc.paths ?? {};
    const pathKeys = Object.keys(paths);
    const replacePath = pathKeys.find((p) => {
      const lower = p.toLowerCase();
      return lower.includes("replace_pm_portfolio") && lower.includes("rpc");
    });

    const replace_pm_portfolio_visible = Boolean(replacePath);

    return NextResponse.json({
      replace_pm_portfolio_visible,
      openapi_path: replacePath ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error de red";
    return NextResponse.json(
      { replace_pm_portfolio_visible: false, error: message },
      { status: 502 },
    );
  }
}
