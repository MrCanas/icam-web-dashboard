/**
 * Iniciales para avatares. Puro y sin dependencias de servidor: lo importa
 * tanto el header (cliente) como los repositorios (service role).
 */

export function initialsFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function initialsFromDisplayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return "?";
}

/** Iniciales de un usuario del portal: nombre si lo hay, si no el email. */
export function initialsForUser(name: string, email: string): string {
  const fromName = initialsFromDisplayName(name);
  return fromName === "?" ? initialsFromEmail(email) : fromName;
}
