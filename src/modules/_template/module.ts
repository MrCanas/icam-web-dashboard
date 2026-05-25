import type { ModuleDefinition } from "@/registry/types";

/**
 * Plantilla de módulo — NO registrar en `src/registry/modules.ts`.
 *
 * Al clonar el módulo:
 * - Renombra `templateModule` → `<area>Module` (p. ej. `crmModule`)
 * - Sustituye `key`, `label`, `icon`, rutas y acciones
 * - Añade el módulo a `MODULES` en el registro central
 */
export const templateModule: ModuleDefinition = {
  key: "template",
  label: "Template",
  icon: "box",
  pathPrefix: "/dashboard/template",
  defaultPath: "/dashboard/template",
  routes: [
    {
      key: "template.list",
      path: "/dashboard/template",
      label: "Listado",
      match: (p) => p === "/dashboard/template",
    },
  ],
  actions: [
    { key: "template.read", label: "Ver" },
    { key: "template.write", label: "Editar" },
  ],
};
