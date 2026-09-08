import type { ModuleDefinition } from "@/registry/types";

/**
 * Zona «Corporativas»: la foto económica del grupo (GIIC, ICI, ICAM).
 *
 * Va en zona propia y no como subpestaña de Financiero a propósito: aquí están la
 * cuenta de resultados y las cuentas depositadas del grupo, y el acceso al
 * portfolio de proyectos no debe arrastrar ese permiso. Quien lo necesite lo
 * recibe expresamente (`npm run auth:grant`).
 *
 * Las `key` quedan congeladas en cuanto esto se despliegue: son lo que guarda
 * `app_user_route_deny.route_key`. Renombrarlas deja denegaciones huérfanas.
 */
export const corporativoModule: ModuleDefinition = {
  key: "corporativo",
  label: "Corporativas",
  icon: "briefcase",
  pathPrefix: "/dashboard/corporativo",
  defaultPath: "/dashboard/corporativo",
  routes: [
    {
      key: "corporativo.executive",
      path: "/dashboard/corporativo",
      label: "Executive",
      match: (p) => p === "/dashboard/corporativo",
    },
    {
      key: "corporativo.detalle",
      path: "/dashboard/corporativo/detalle",
      label: "Detalle",
      match: (p) => p.startsWith("/dashboard/corporativo/detalle"),
    },
  ],
  actions: [
    { key: "corporativo.read", label: "Ver" },
    { key: "corporativo.write", label: "Editar" },
  ],
};
