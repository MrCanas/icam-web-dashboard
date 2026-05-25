import type { ModuleDefinition } from "@/registry/types";

export const portfolioModule: ModuleDefinition = {
  key: "portfolio",
  label: "Portfolio",
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
  ],
  actions: [
    { key: "portfolio.read", label: "Ver" },
    { key: "portfolio.write", label: "Editar" },
    { key: "portfolio.delete", label: "Borrar" },
  ],
};
