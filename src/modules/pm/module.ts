import type { ModuleDefinition } from "@/registry/types";

export const pmModule: ModuleDefinition = {
  key: "pm",
  label: "Proyectos",
  icon: "gantt",
  pathPrefix: "/dashboard/pm",
  defaultPath: "/dashboard/pm/detalle",
  // `pm.overview` ya no se registra: /dashboard/pm/overview redirige a
  // /dashboard/portfolio/pm-overview (key `portfolio.pm_overview`).
  routes: [
    {
      key: "pm.detalle",
      path: "/dashboard/pm/detalle",
      label: "Todos los proyectos",
      // proyecto/[id] es el Resumen Ejecutivo; sus subpáginas de
      // planificación/actas resuelven a sus propias keys de permiso.
      match: (p) =>
        p === "/dashboard/pm/detalle" ||
        (p.startsWith("/dashboard/pm/proyecto/") && !/\/(planificacion|actas)(\/|$)/.test(p)),
    },
    {
      key: "pm.planificacion",
      path: "/dashboard/pm/planificacion",
      label: "Planificación",
      match: (p) =>
        p === "/dashboard/pm/planificacion" ||
        /^\/dashboard\/pm\/proyecto\/[^/]+\/planificacion$/.test(p),
    },
    {
      key: "pm.proyectos",
      path: "/dashboard/pm/proyectos",
      label: "Mapeo maestro",
      match: (p) => p === "/dashboard/pm/proyectos",
    },
    {
      key: "pm.actas",
      path: "/dashboard/pm/actas",
      label: "Actas",
      match: (p) =>
        p === "/dashboard/pm/actas" ||
        p.startsWith("/dashboard/pm/actas/") ||
        /^\/dashboard\/pm\/proyecto\/[^/]+\/actas$/.test(p),
    },
  ],
  actions: [
    { key: "pm.read", label: "Ver" },
    { key: "pm.write", label: "Editar" },
  ],
};
