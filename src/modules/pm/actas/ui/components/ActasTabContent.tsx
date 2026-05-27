import type { ActasProjectTab } from "@/modules/pm/actas/types";

interface ActasTabContentProps {
  tab: ActasProjectTab;
  projectCode: string;
}

const PLACEHOLDER: Record<ActasProjectTab, string> = {
  operativo:
    "Vista operativa del proyecto — árbol de categorías y elementos con estado.",
  acta: "Vista de acta consolidada por rango de fechas.",
  historico: "Evolución completa de un elemento concreto.",
  ajustes: "Configuración del proyecto (fase, tipo de activo, módulos) — próximamente.",
};

export function ActasTabContent({ tab }: ActasTabContentProps) {
  return (
    <section
      className="bg-card rounded-b-lg border border-t-0 border-subtle/50 p-6 min-h-[240px]"
      aria-label={`Contenido tab ${tab}`}
    >
      <p className="text-sm text-text-muted">{PLACEHOLDER[tab]}</p>
    </section>
  );
}
