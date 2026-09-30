import type { Metadata } from "next";
import { readFile } from "node:fs/promises";

import { requireRouteAccess } from "@/lib/auth/require-route-access";
import type { InformeJson } from "@/modules/pm/informes/slides/tipos";
import GaleriaSlidesPage from "@/modules/pm/informes/ui/pages/GaleriaSlidesPage";

export const metadata: Metadata = { title: "Galería de slides" };

/** En desarrollo, INFORMES_GALERIA_JSON apunta a un informe.json local (confidencial: no se commitea). */
async function ejemplo(): Promise<InformeJson | null> {
  const ruta = process.env.NODE_ENV === "production" ? undefined : process.env.INFORMES_GALERIA_JSON;
  if (!ruta) return null;
  try {
    return JSON.parse(await readFile(ruta, "utf8")) as InformeJson;
  } catch {
    return null;
  }
}

export default async function Page() {
  await requireRouteAccess("pm.informes");
  return <GaleriaSlidesPage inicial={await ejemplo()} />;
}
