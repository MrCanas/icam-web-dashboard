import { notFound } from "next/navigation";

/**
 * Catch-all de direcciones inexistentes bajo /dashboard.
 *
 * El not-found raíz de Next atiende las URLs que no casan con ninguna ruta, y
 * lo hace fuera del layout del dashboard: card suelta, sin Header ni nav. Este
 * catch-all las recoge dentro del segmento y lanza notFound(), con lo que Next
 * renderiza dashboard/not-found.tsx con el chrome intacto.
 *
 * Las rutas reales ganan siempre al catch-all, así que esto solo se ve cuando
 * la dirección de verdad no existe. `/dashboard` a secas no lleva segmentos y
 * sigue cayendo en el 404 global.
 */
export default function DashboardCatchAll() {
  notFound();
}
