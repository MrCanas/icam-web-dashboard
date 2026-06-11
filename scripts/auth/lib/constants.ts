/** Contraseña inicial del seed (Prompt 1). */
export const INITIAL_PORTAL_PASSWORD = "Capital2030";

export const BCRYPT_ROUNDS = 10;

export const ZONE_KEYS = [
  "financiero",
  "pm",
  "adquisiciones",
  "data",
] as const;

export type ZoneKey = (typeof ZONE_KEYS)[number];

export const ZONE_ROLES = ["admin", "editor", "lector"] as const;

export type ZoneRole = (typeof ZONE_ROLES)[number];

export const USER_MAPPING_PATH = "docs/actas/06-user-mapping.json";
