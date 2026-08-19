"use server";

import { requirePmReadContext } from "@/modules/pm/actas/actions/require-pm-read";
import {
  fetchMasterModulesWithCounts,
  fetchTemplatePreviewCounts,
  type MasterModuleOption,
  type TemplatePreviewCounts,
} from "@/modules/pm/actas/data/projectTemplateRepository";

export type ProjectWizardCatalogResult =
  | {
      ok: true;
      modules: MasterModuleOption[];
      corePreview: TemplatePreviewCounts;
    }
  | { ok: false; error: string };

export async function getProjectWizardCatalog(): Promise<ProjectWizardCatalogResult> {
  const access = await requirePmReadContext();
  if (!access.ok) return access;
  const ctx = access.ctx;
  try {
    const modules = await fetchMasterModulesWithCounts(ctx);
    const corePreview = await fetchTemplatePreviewCounts(ctx, []);
    if (modules.length === 0 || corePreview.coreElementCount === 0) {
      return {
        ok: false,
        error:
          "El catálogo maestro no está cargado. Ejecuta npm run actas:seed-master-catalog primero.",
      };
    }
    return { ok: true, modules, corePreview };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar catálogo";
    return { ok: false, error: message };
  }
}

export async function getProjectWizardPreview(
  selectedModuleIds: string[],
): Promise<
  | { ok: true; preview: TemplatePreviewCounts }
  | { ok: false; error: string }
> {
  const access = await requirePmReadContext();
  if (!access.ok) return access;
  const ctx = access.ctx;
  try {
    const preview = await fetchTemplatePreviewCounts(ctx, selectedModuleIds);
    return { ok: true, preview };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al calcular resumen";
    return { ok: false, error: message };
  }
}
