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
      key: "portfolio.overview",
      path: "/dashboard/portfolio/overview",
      label: "WIP",
      match: (p) => p.startsWith("/dashboard/portfolio/overview"),
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
  ],
  actions: [
    { key: "portfolio.read", label: "Ver" },
    { key: "portfolio.write", label: "Editar" },
    { key: "portfolio.delete", label: "Borrar" },
  ],
};
