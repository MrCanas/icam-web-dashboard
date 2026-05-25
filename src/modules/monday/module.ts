import type { ModuleDefinition } from "@/registry/types";

export const mondayModule: ModuleDefinition = {
  key: "monday",
  label: "Monday",
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
  ],
  actions: [
    { key: "monday.read", label: "Ver" },
    { key: "monday.sync", label: "Sincronizar" },
  ],
};
