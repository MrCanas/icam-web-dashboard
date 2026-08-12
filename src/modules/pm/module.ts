import type { ModuleDefinition } from "@/registry/types";

export const pmModule: ModuleDefinition = {
  key: "pm",
  label: "PM",
  icon: "gantt",
  pathPrefix: "/dashboard/pm",
  defaultPath: "/dashboard/pm/overview",
  routes: [
    {
      key: "pm.overview",
      path: "/dashboard/pm/overview",
      label: "Overview",
      match: (p) => p === "/dashboard/pm/overview",
    },
    {
      key: "pm.detalle",
      path: "/dashboard/pm/detalle",
      label: "Detalle proyecto",
      match: (p) => p === "/dashboard/pm/detalle" || p.startsWith("/dashboard/pm/proyecto/"),
    },
    {
      key: "pm.planificacion",
      path: "/dashboard/pm/planificacion",
      label: "Planificación",
      match: (p) => p === "/dashboard/pm/planificacion",
    },
    {
      key: "pm.proyectos",
      path: "/dashboard/pm/proyectos",
      label: "Proyectos",
      match: (p) => p === "/dashboard/pm/proyectos",
    },
    {
      key: "pm.actas",
      path: "/dashboard/pm/actas",
      label: "Actas",
      match: (p) => p === "/dashboard/pm/actas" || p.startsWith("/dashboard/pm/actas/"),
    },
  ],
  actions: [
    { key: "pm.read", label: "Ver" },
    { key: "pm.write", label: "Editar" },
  ],
};
