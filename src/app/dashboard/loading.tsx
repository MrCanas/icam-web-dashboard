import { PageSkeleton } from "@/components/PageSkeleton";

/**
 * Fallback de carga de TODO el dashboard.
 *
 * Un `loading.tsx` crea el límite de Suspense de su segmento y lo heredan todos
 * los descendientes que no tengan el suyo, así que este fichero cubre de una vez
 * las 16 páginas que se quedaban en blanco mientras el servidor renderizaba.
 * Las que necesitan una silueta distinta declaran el suyo propio y ganan a este.
 */
export default function Loading() {
  return <PageSkeleton />;
}
