/**
 * Sincroniza Inversores desde la terminal.
 *
 * El cron lo hace solo cada día; esto existe para la puesta en marcha y para
 * diagnosticar, que es cuando hace falta ver el detalle por módulo.
 *
 *   npm run inversores:sync -- --dry-run          # lee y cuenta, no escribe
 *   npm run inversores:sync                       # de verdad
 *   npm run inversores:sync -- --modulo Aportes_Repartos
 */
import { cargarEnv } from "../pm/lib/env";
import type { UserContext } from "@/lib/auth/currentUser";
import { sincronizarInversores } from "@/modules/portfolio/inversores/logic/inversoresSync";

const CTX: UserContext = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "inversores-script@imparcapital.com",
  name: "Script inversores:sync",
  zones: [],
  isPlatformAdmin: false,
  deniedRouteKeys: [],
};

async function main(): Promise<void> {
  cargarEnv();

  const dryRun = process.argv.includes("--dry-run");
  const iModulo = process.argv.indexOf("--modulo");
  const soloModulos = iModulo >= 0 ? [process.argv[iModulo + 1]] : undefined;

  console.log(dryRun ? "Simulación (no se escribe nada).\n" : "Sincronización real.\n");

  const resultado = await sincronizarInversores(CTX, {
    origen: "script",
    dryRun,
    ...(soloModulos ? { soloModulos } : {}),
  });

  if (!resultado.ok) {
    console.error(`✗ ${resultado.error}`);
    for (const p of resultado.problemas ?? []) {
      console.error(`    · ${p.modulo}.${p.columna}: ${p.detalle}`);
    }
    process.exitCode = 1;
    return;
  }

  const ancho = Math.max(...resultado.modulos.map((m) => m.modulo.length), 8);
  console.log(
    `  ${"módulo".padEnd(ancho)}  ${"leídos".padStart(7)}  ${"escritos".padStart(8)}  ` +
      `${"lápidas".padStart(7)}  ${"huérf.".padStart(6)}  ${"ms".padStart(6)}`,
  );
  for (const m of resultado.modulos) {
    console.log(
      `  ${m.modulo.padEnd(ancho)}  ${String(m.leidos).padStart(7)}  ${String(m.escritos).padStart(8)}  ` +
        `${String(m.lapidas).padStart(7)}  ${String(m.huerfanos).padStart(6)}  ${String(m.ms).padStart(6)}` +
        (m.error ? `   ✗ ${m.error}` : ""),
    );
  }

  const huerfanos = resultado.modulos.reduce((acc, m) => acc + m.huerfanos, 0);
  if (huerfanos > 0) {
    console.log(
      `\n⚠ ${huerfanos} enlace(s) apuntan a una cuenta que no está en el espejo. Si el número no ` +
        "baja tras un sync completo, hay permisos de módulo que revisar en Zoho.",
    );
  }
  for (const aviso of resultado.avisos) {
    console.log(`⚠ ${aviso.modulo}.${aviso.columna}: ${aviso.detalle}`);
  }

  console.log(
    `\n${resultado.estado === "ok" ? "✓" : "⚠"} ${resultado.estado} en ${resultado.duracionMs} ms` +
      (dryRun ? " (nada escrito)" : ""),
  );
  if (resultado.estado !== "ok") process.exitCode = 1;
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
