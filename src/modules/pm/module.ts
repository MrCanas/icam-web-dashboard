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
      // Fuera de la nav (el grid es redundante con la fila de proyectos),
      // pero su key gobierna el permiso de proyecto/[id] y de la fila misma.
      hiddenInNav: true,
      // proyecto/[id] es el Resumen Ejecutivo; sus subpáginas de
      // planificación/actas/avance de obra resuelven a sus propias keys de
      // permiso. routeKeyForPathname devuelve el PRIMER match del array y esta
      // ruta va la primera: si no las excluye, se las traga.
      match: (p) =>
        p === "/dashboard/pm/detalle" ||
        (p.startsWith("/dashboard/pm/proyecto/") &&
          !/\/(planificacion|actas|avance-obra)(\/|$)/.test(p)),
    },
    {
      key: "pm.planificacion",
      path: "/dashboard/pm/planificacion",
      label: "Planificación",
      // El hub sale de la fila secundaria: se abre desde el menú de
      // Configuración. Dentro de un proyecto sigue como subpestaña propia.
      hiddenInNav: true,
      match: (p) =>
        p === "/dashboard/pm/planificacion" ||
        /^\/dashboard\/pm\/proyecto\/[^/]+\/planificacion$/.test(p),
    },
    {
      key: "pm.proyectos",
      path: "/dashboard/pm/proyectos",
      label: "Mapeo maestro",
      // Tarea de mantenimiento, no de consulta diaria: vive en Configuración.
      hiddenInNav: true,
      match: (p) => p === "/dashboard/pm/proyectos",
    },
    {
      key: "pm.actas",
      path: "/dashboard/pm/actas",
      label: "Actas",
      // Las actas se abren desde la subpestaña de cada proyecto; el hub con
      // sidebar (alta, duplicar, archivar, reordenar) queda en Configuración.
      hiddenInNav: true,
      match: (p) =>
        p === "/dashboard/pm/actas" ||
        p.startsWith("/dashboard/pm/actas/") ||
        /^\/dashboard\/pm\/proyecto\/[^/]+\/actas$/.test(p),
    },
    {
      key: "pm.avance_obra",
      path: "/dashboard/pm/avance-obra",
      label: "Avance de obra",
      // Igual que las demás: la subpestaña vive dentro del proyecto y el hub
      // (bandeja de salida hacia Zoho, listado de promociones) en Configuración.
      // Va la última del array a propósito: pmLandingPath cae en la primera
      // ruta visible y no queremos mover a dónde aterriza nadie.
      hiddenInNav: true,
      match: (p) =>
        p === "/dashboard/pm/avance-obra" ||
        /^\/dashboard\/pm\/proyecto\/[^/]+\/avance-obra$/.test(p),
    },
  ],
  actions: [
    { key: "pm.read", label: "Ver" },
    { key: "pm.write", label: "Editar" },
  ],
};
