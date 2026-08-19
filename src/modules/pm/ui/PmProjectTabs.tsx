"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface PmProjectTabsProps {
  idActivo: string;
  /** false cuando el usuario tiene denegada pm.planificacion. */
  showPlanificacion?: boolean;
  /** false cuando el usuario tiene denegada pm.avance_obra. */
  showAvanceObra?: boolean;
  /** false cuando el usuario tiene denegada pm.actas. */
  showActas?: boolean;
}

/**
 * Subpestañas de un proyecto: Resumen Ejecutivo / Planificación / Avance de
 * obra / Actas. Avance de obra va junto a Planificación porque las dos hablan
 * de la ejecución: una del cuándo y otra del cuánto.
 */
export function PmProjectTabs({
  idActivo,
  showPlanificacion = true,
  showAvanceObra = true,
  showActas = true,
}: PmProjectTabsProps) {
  const pathname = usePathname();
  const base = `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}`;

  const tabs = [
    {
      key: "resumen",
      label: "Resumen Ejecutivo",
      href: base,
      active: pathname === base,
    },
    ...(showPlanificacion
      ? [
          {
            key: "planificacion",
            label: "Planificación",
            href: `${base}/planificacion`,
            active: pathname === `${base}/planificacion`,
          },
        ]
      : []),
    ...(showAvanceObra
      ? [
          {
            key: "avance-obra",
            label: "Avance de obra",
            href: `${base}/avance-obra`,
            active: pathname === `${base}/avance-obra`,
          },
        ]
      : []),
    ...(showActas
      ? [
          {
            key: "actas",
            label: "Actas",
            href: `${base}/actas`,
            active: pathname === `${base}/actas`,
          },
        ]
      : []),
  ];

  return (
    <nav
      className="flex items-center gap-0 border-b border-subtle/50 bg-card rounded-t-lg overflow-x-auto"
      aria-label="Secciones del proyecto"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-[3px] transition ${
            tab.active
              ? "border-icam-900 text-icam-900 bg-icam-900/5"
              : "border-transparent text-text-muted hover:text-text-primary hover:bg-page"
          }`}
          aria-current={tab.active ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
