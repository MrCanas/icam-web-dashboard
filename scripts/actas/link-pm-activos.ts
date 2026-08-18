/**
 * Vínculo explícito proyecto de Actas ↔ activo PM (project.pm_activo_id).
 *
 * La resolución en la app cae por defecto al código normalizado (CSP-10 ↔
 * CSP10), que cubre la mayoría del catálogo. Este script es para las parejas
 * cuyos códigos NO coinciden ni normalizados y que, por tanto, solo se pueden
 * establecer a mano.
 *
 * Aditivo y idempotente: solo escribe pm_activo_id donde está a NULL y nunca
 * pisa un vínculo existente (avisa y sale). Dry-run por defecto; escribe con
 * `--apply`.
 *
 *   npm run actas:link-pm-activos          # muestra qué haría
 *   npm run actas:link-pm-activos -- --apply
 */
import { createActasServerClient } from "./lib/supabase-server";

/** project.code → pm_activos.id_activo. Confirmado con la PMO. */
const PAREJAS: Record<string, string> = {
  PC25: "PC25-26-RESIDENCIAL",
  SA31: "SA-33-31",
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const supabase = createActasServerClient();

  const { data: activos, error: errActivos } = await supabase
    .from("pm_activos")
    .select("id, id_activo");
  if (errActivos) throw new Error(`pm_activos: ${errActivos.message}`);

  const { data: projects, error: errProjects } = await supabase
    .from("project")
    .select("id, code, pm_activo_id");
  if (errProjects) throw new Error(`project: ${errProjects.message}`);

  const activoPorCodigo = new Map(
    (activos ?? []).map((a) => [a.id_activo as string, a.id as string]),
  );
  const proyectoPorCodigo = new Map(
    (projects ?? []).map((p) => [p.code as string, p]),
  );

  let escritos = 0;
  for (const [projectCode, idActivo] of Object.entries(PAREJAS)) {
    const project = proyectoPorCodigo.get(projectCode);
    const activoId = activoPorCodigo.get(idActivo);

    if (!project) {
      console.error(`✗ no existe el proyecto de actas ${projectCode}`);
      continue;
    }
    if (!activoId) {
      console.error(`✗ no existe el activo PM ${idActivo}`);
      continue;
    }
    if (project.pm_activo_id === activoId) {
      console.log(`= ${projectCode} → ${idActivo} (ya vinculado)`);
      continue;
    }
    if (project.pm_activo_id) {
      console.error(
        `✗ ${projectCode} ya apunta a otro activo (${project.pm_activo_id}); no se pisa`,
      );
      continue;
    }

    if (!apply) {
      console.log(`~ ${projectCode} → ${idActivo} (dry-run)`);
      continue;
    }

    const { error } = await supabase
      .from("project")
      .update({ pm_activo_id: activoId })
      .eq("id", project.id);
    if (error) {
      console.error(`✗ ${projectCode} → ${idActivo}: ${error.message}`);
      continue;
    }
    console.log(`✓ ${projectCode} → ${idActivo}`);
    escritos += 1;
  }

  console.log(
    apply
      ? `\nHecho: ${escritos} vínculo(s) escrito(s).`
      : "\nDry-run. Repite con --apply para escribir.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
