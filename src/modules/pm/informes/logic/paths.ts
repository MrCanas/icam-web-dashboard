/** Dónde se sirve la app compilada (public/informes-app). */
export const INFORMES_APP_BASE = "/informes-app/index.html";

/** URL de la app; con activo, abre el paso 0 con ese proyecto ya elegido. */
export function informesAppPath(idActivo?: string): string {
  return idActivo
    ? `${INFORMES_APP_BASE}?activo=${encodeURIComponent(idActivo)}`
    : INFORMES_APP_BASE;
}
