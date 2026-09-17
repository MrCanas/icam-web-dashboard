/**
 * Recharts no promete la forma de lo que pasa a `onClick`.
 *
 * Según la marca (`Bar`, `Cell`, `Pie`) llega el dato directamente o envuelto
 * en `payload`, y a veces en `payload.payload`. Las gráficas de portfolio ya
 * castean a la defensiva por esto mismo; aquí se centraliza en vez de repetir
 * el casteo en cuatro sitios.
 */
export function payloadDe<T>(entry: unknown): T | null {
  if (entry === null || typeof entry !== "object") return null;
  const uno = (entry as { payload?: unknown }).payload;
  if (uno && typeof uno === "object") {
    const dos = (uno as { payload?: unknown }).payload;
    return ((dos && typeof dos === "object" ? dos : uno) as T) ?? null;
  }
  return entry as T;
}
