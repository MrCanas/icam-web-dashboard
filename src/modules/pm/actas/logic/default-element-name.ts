/**
 * Genera un nombre por defecto único entre los hermanos para la creación inline
 * de elementos / sub-elementos. Si "Nuevo elemento" ya existe, prueba
 * "Nuevo elemento 2", "Nuevo elemento 3", … hasta encontrar uno libre.
 *
 * La unicidad real la garantiza el servidor; esto solo evita la colisión más
 * habitual (crear varios seguidos) para que la acción no falle.
 */
export function nextDefaultName(base: string, existingNames: string[]): string {
  const taken = new Set(
    existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
  );
  if (!taken.has(base.toLowerCase())) {
    return base;
  }
  let i = 2;
  while (taken.has(`${base} ${i}`.toLowerCase())) {
    i += 1;
  }
  return `${base} ${i}`;
}

export const DEFAULT_ELEMENT_NAME = "Nuevo elemento";
export const DEFAULT_SUBELEMENT_NAME = "Nuevo sub-elemento";
