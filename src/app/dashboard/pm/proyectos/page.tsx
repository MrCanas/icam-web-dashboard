import type { Metadata } from "next";

import { routeLabel } from "@/registry/routes";

export const metadata: Metadata = { title: routeLabel("pm.proyectos") };

export { default } from "@/modules/pm/planificacion/ui/pages/ProyectosPage";
