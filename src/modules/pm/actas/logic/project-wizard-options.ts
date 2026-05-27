import type { ProjectPhase } from "@/modules/pm/actas/types";

/** Fases disponibles en el wizard de alta (subset del check de BD). */
export const WIZARD_PROJECT_PHASES: {
  value: ProjectPhase;
  label: string;
}[] = [
  { value: "adquisicion", label: "Adquisición" },
  { value: "desarrollo", label: "Desarrollo" },
  { value: "comercializacion", label: "Comercialización" },
  { value: "desinversion", label: "Desinversión" },
];

export const WIZARD_ASSET_TYPES: { value: string; label: string }[] = [
  { value: "residencial", label: "Residencial" },
  { value: "oficinas", label: "Oficinas" },
  { value: "hotel", label: "Hotelero" },
  { value: "mixto", label: "Mixto" },
  { value: "otro", label: "Otro" },
];

const CODE_PATTERN = /^[A-Z0-9-]+$/;

export function normalizeProjectCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 10);
}

export function isValidProjectCodeFormat(code: string): boolean {
  const c = code.trim();
  return c.length >= 2 && c.length <= 10 && CODE_PATTERN.test(c);
}
