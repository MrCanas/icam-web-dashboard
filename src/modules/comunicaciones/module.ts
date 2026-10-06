import type { ModuleDefinition } from "@/registry/types";

/**
 * Zona «Comunicaciones»: correos a inversores, con la lista de destinatarios y
 * la plantilla a la vista ANTES de que salga nada.
 *
 * Va en zona propia, como Corporativas: quien prepara comunicaciones (relación
 * con inversores, marketing) no tiene por qué ver el portfolio, y al revés. La
 * zona nace sin nadie concedido (migración 047).
 *
 * Las `key` quedan congeladas en cuanto esto se despliegue: son lo que guarda
 * `app_user_route_deny.route_key`. Renombrarlas deja denegaciones huérfanas.
 */
export const comunicacionesModule: ModuleDefinition = {
  key: "comunicaciones",
  label: "Comunicaciones",
  icon: "mail",
  pathPrefix: "/dashboard/comunicaciones",
  defaultPath: "/dashboard/comunicaciones",
  routes: [
    {
      // La primera ruta es donde aterriza la pestaña de la zona. Recoge también
      // el detalle de cada comunicación; «nueva» se excluye a propósito porque
      // el primer match gana y tiene su propia key.
      key: "comunicaciones.historial",
      path: "/dashboard/comunicaciones",
      label: "Historial",
      match: (p) =>
        p === "/dashboard/comunicaciones" ||
        (p.startsWith("/dashboard/comunicaciones/") &&
          !p.startsWith("/dashboard/comunicaciones/nueva") &&
          !p.startsWith("/dashboard/comunicaciones/ajustes")),
    },
    {
      key: "comunicaciones.nueva",
      path: "/dashboard/comunicaciones/nueva",
      label: "Nueva",
      match: (p) => p.startsWith("/dashboard/comunicaciones/nueva"),
    },
    {
      // El interruptor general y el modo. Los ve quien tenga la zona; los
      // cambia solo su administrador (lo comprueba la acción).
      key: "comunicaciones.ajustes",
      path: "/dashboard/comunicaciones/ajustes",
      label: "Ajustes",
      match: (p) => p.startsWith("/dashboard/comunicaciones/ajustes"),
    },
  ],
  actions: [
    { key: "comunicaciones.read", label: "Ver" },
    { key: "comunicaciones.write", label: "Preparar y enviar" },
    { key: "comunicaciones.admin", label: "Cambiar los ajustes de envío" },
  ],
};
