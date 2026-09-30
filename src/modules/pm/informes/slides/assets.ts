/**
 * Logos, iconos y fondo de cierre del design system, servidos desde
 * public/informes/ds (mismos ficheros que design-system/uploads del proyecto
 * original). Los iconos se piden por nombre en el JSON («kpi-tir», «logros»…).
 */
const BASE = "/informes/ds/";

const NOMBRES_ICONO = [
  "situacion-actual",
  "compraventa-financiacion",
  "operacion-cronograma",
  "logros",
  "kpi-fondos-propios",
  "kpi-roe",
  "kpi-tir",
  "kpi-plazo",
  "kpi-ltv",
  "kpi-yield",
  "kpi-yield-salida",
  "kpi-noi",
  "vehiculo-aeat",
  "vehiculo-obligacion-mercantil",
  "vehiculo-inscripcion-rm",
  "vehiculo-siguiente-informe",
  "desinversion-rotacion",
  "desinversion-red-mercado",
  "desinversion-firma",
  "desinversion-calendario-bloqueo",
  "desinversion-ubicacion-vision",
] as const;

export const assets = {
  logoAzul: `${BASE}logo-impar-capital-azul.png`,
  logoBlanco: `${BASE}logo-impar-capital-blanco.png`,
  cierreMosaico: `${BASE}fondo-cierre-mosaico.png`,
  iconos: Object.fromEntries(
    NOMBRES_ICONO.map((k) => [k, `${BASE}${/^(kpi|vehiculo|desinversion)-/.test(k) ? k : `icono-${k}`}.png`]),
  ) as Record<string, string>,
};

/** Icono por nombre; un nombre desconocido se usa tal cual (ruta propia). */
export function icono(nombre: string): string {
  return assets.iconos[nombre] || nombre;
}
