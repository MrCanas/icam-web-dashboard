import type { Metadata } from "next";

import { routeLabel } from "@/registry/routes";

export const metadata: Metadata = { title: routeLabel("pm.planificacion") };

export { default } from "@/modules/pm/planificacion/ui/pages/PlanificacionPage";
