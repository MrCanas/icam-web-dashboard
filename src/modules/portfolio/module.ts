import type { ModuleDefinition } from "@/registry/types";

export const portfolioModule: ModuleDefinition = {
  key: "portfolio",
  label: "Dashboard",
  icon: "building",
  pathPrefix: "/dashboard/portfolio",
  defaultPath: "/dashboard/portfolio",
  routes: [
    {
      key: "portfolio.executive",
      path: "/dashboard/portfolio",
      label: "Executive",
      match: (p) => p === "/dashboard/portfolio",
    },
    {
      // La key y el path quedan congelados: `key` es lo que guardan las
      // denegaciones de permisos (app_user_route_deny.route_key). Solo cambia
      // la etiqueta visible, que pasó de «Overview» a «WIP» en 2026-09.
      // Oculta de la nav (2026-09): sigue accesible por URL directa y en
      // PermissionMatrix, solo desaparece de la fila de pestañas.
      key: "portfolio.overview",
      path: "/dashboard/portfolio/overview",
      label: "WIP",
      match: (p) => p.startsWith("/dashboard/portfolio/overview"),
      hiddenInNav: true,
    },
    {
      key: "portfolio.rentabilidad",
      path: "/dashboard/portfolio/rentabilidad",
      label: "Rentabilidad",
      match: (p) => p.startsWith("/dashboard/portfolio/rentabilidad"),
    },
    {
      key: "portfolio.proyectos",
      path: "/dashboard/portfolio/proyectos",
      label: "Proyectos",
      match: (p) => p.startsWith("/dashboard/portfolio/proyectos"),
    },
    {
      key: "portfolio.tendencias",
      path: "/dashboard/portfolio/tendencias",
      label: "Tendencias",
      match: (p) => p.startsWith("/dashboard/portfolio/tendencias"),
    },
    {
      key: "portfolio.pm_overview",
      path: "/dashboard/portfolio/pm-overview",
      label: "Overview PM",
      match: (p) => p.startsWith("/dashboard/portfolio/pm-overview"),
    },
    {
      // Key congelada, como la de `portfolio.overview`: es lo que guardan las
      // denegaciones de permisos, y `app_user_route_deny` no tiene FK.
      // Renombrarla dejaría denies huérfanos que `isKnownRouteKey` descarta,
      // lo que ABRIRÍA la pestaña a quien la tenía cerrada.
      //
      // `deniedByDefault` porque aquí se ven nombres, correos y patrimonio de
      // los inversores: nadie la ve hasta que se le concede a mano.
      key: "portfolio.inversores",
      path: "/dashboard/portfolio/inversores",
      label: "Inversores",
      match: (p) => p.startsWith("/dashboard/portfolio/inversores"),
      deniedByDefault: true,
    },
  ],
  actions: [
    { key: "portfolio.read", label: "Ver" },
    { key: "portfolio.write", label: "Editar" },
    { key: "portfolio.delete", label: "Borrar" },
  ],
};
