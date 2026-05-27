import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const BASE_URL =
  process.env.AUTH_TEST_BASE_URL?.trim() || "http://localhost:3000";
const TEST_EMAIL =
  process.env.AUTH_TEST_EMAIL?.trim() || "javiercanas@imparcapital.com";
const TEST_PASSWORD = process.env.AUTH_TEST_PASSWORD?.trim() || "Capital2030";

const ZONE_KEYS = ["financiero", "pm", "adquisiciones", "data"] as const;

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function extractCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  const match = /icam-auth=([^;]+)/.exec(setCookie);
  return match?.[1] ?? null;
}

async function main(): Promise<void> {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Login: ${TEST_EMAIL}\n`);

  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.text();
    fail(`POST /api/auth/login → ${loginRes.status}: ${body}`);
  }

  const loginJson = (await loginRes.json()) as { success?: boolean };
  if (!loginJson.success) {
    fail("POST /api/auth/login no devolvió success: true");
  }

  const setCookie = loginRes.headers.get("set-cookie");
  const cookieValue = extractCookie(setCookie);
  if (!cookieValue) {
    fail("No se recibió cookie icam-auth en Set-Cookie");
  }

  const meRes = await fetch(`${BASE_URL}/api/me`, {
    headers: { Cookie: `icam-auth=${cookieValue}` },
  });

  if (!meRes.ok) {
    const body = await meRes.text();
    fail(`GET /api/me → ${meRes.status}: ${body}`);
  }

  const me = (await meRes.json()) as {
    email?: string;
    zones?: { zone_key: string; role: string }[];
  };

  if (me.email?.toLowerCase() !== TEST_EMAIL.toLowerCase()) {
    fail(`email esperado ${TEST_EMAIL}, recibido ${me.email ?? "(vacío)"}`);
  }

  if (!Array.isArray(me.zones) || me.zones.length !== 4) {
    fail(`zones: esperadas 4 entradas, recibidas ${me.zones?.length ?? 0}`);
  }

  for (const key of ZONE_KEYS) {
    const row = me.zones!.find((z) => z.zone_key === key);
    if (!row) {
      fail(`falta zona ${key}`);
    }
    if (row.role !== "admin") {
      fail(`zona ${key}: esperado admin, recibido ${row.role}`);
    }
  }

  console.log("OK: login + /api/me");
  console.log(`  email: ${me.email}`);
  console.log(
    `  zones: ${me.zones!.map((z) => `${z.zone_key}=${z.role}`).join(", ")}`,
  );
}

void main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
