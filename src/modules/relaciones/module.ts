import type { ModuleDefinition } from "@/registry/types";

/**
 * Zona «Relaciones»: ImparComm (CRM de relaciones, https://impar-comm.vercel.app)
 * incrustado en un iframe.
 *
 * Va en zona propia: ImparComm comparte usuarios con icam pero no todo el que
 * entra a icam tiene que verlo. La zona nace sin nadie concedido (migración 051).
 * ImparComm tiene que listar go.imparcapital.com en su `frame-ancestors`.
 *
 * Las `key` quedan congeladas en cuanto esto se despliegue: son lo que guarda
 * `app_user_route_deny.route_key`. Renombrarlas deja denegaciones huérfanas.
 */
export const relacionesModule: ModuleDefinition = {
  key: "relaciones",
  label: "Relaciones",
  icon: "users",
  pathPrefix: "/dashboard/relaciones",
  defaultPath: "/dashboard/relaciones",
  routes: [
    {
      key: "relaciones.imparcomm",
      path: "/dashboard/relaciones",
      label: "ImparComm",
      match: (p) => p.startsWith("/dashboard/relaciones"),
    },
  ],
  actions: [{ key: "relaciones.read", label: "Ver" }],
};
