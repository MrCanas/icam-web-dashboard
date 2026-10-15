import type { DatosDeEnvios } from "@/modules/comunicaciones/logic/loadComunicaciones";

/** Lo que el chip de entorno necesita de `DatosDeEnvios`; el candado entero no viaja al navegador. */
export type EntornoDeEnvio = Omit<DatosDeEnvios, "permitidos">;

export function entornoDe(datos: DatosDeEnvios): EntornoDeEnvio {
  const { permitidos: _permitidos, ...resto } = datos;
  return resto;
}
