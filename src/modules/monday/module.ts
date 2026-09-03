import type { ModuleDefinition } from "@/registry/types";

export const mondayModule: ModuleDefinition = {
  key: "monday",
  label: "Adquisiciones",
  icon: "layout-grid",
  pathPrefix: "/dashboard/monday",
  defaultPath: "/dashboard/monday",
  routes: [
    {
      key: "monday.dashboard",
      path: "/dashboard/monday",
      label: "Dashboard",
      match: (p) => p === "/dashboard/monday",
    },
    {
      key: "monday.historico",
      path: "/dashboard/monday/historico",
      label: "Histórico",
      match: (p) => p.startsWith("/dashboard/monday/historico"),
    },
    {
      key: "monday.logs",
      path: "/dashboard/monday/logs",
      label: "Logs de sincronización",
      // Inspector técnico: fuera de la nav, pero necesita su propia key para que
      // la página tenga guarda de servidor (antes heredaba el permiso de zona y
      // se renderizaba sin ningún corte).
      hiddenInNav: true,
      match: (p) => p.startsWith("/dashboard/monday/logs"),
    },
  ],
  actions: [
    { key: "monday.read", label: "Ver" },
    { key: "monday.sync", label: "Sincronizar" },
  ],
};
