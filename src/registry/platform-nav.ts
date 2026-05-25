import type { PlatformNavSection } from "@/registry/types";

/** Cross-cutting admin tools (not a business module). */
export const PLATFORM_NAV: PlatformNavSection = {
  key: "data",
  label: "Data",
  pathPrefix: "/dashboard/data",
  defaultPath: "/dashboard/data/upload",
  routes: [
    {
      key: "data.upload",
      path: "/dashboard/data/upload",
      label: "Subir datos",
      match: (p) => p.startsWith("/dashboard/data/upload"),
    },
    {
      key: "data.activity",
      path: "/dashboard/data/activity",
      label: "Actividad",
      match: (p) => p.startsWith("/dashboard/data/activity"),
    },
  ],
};
