/**
 * Mide cuánto tarda una promesa y lo escribe en el log del servidor.
 * Solo con PERF_LOG=1: en cualquier otro caso devuelve la promesa tal cual.
 *
 *   const link = await timed("actas.link", fetchActasLinkForPmActivo(ctx, id));
 */
export async function timed<T>(label: string, promise: Promise<T>): Promise<T> {
  if (process.env.PERF_LOG !== "1") return promise;
  const start = performance.now();
  try {
    return await promise;
  } finally {
    console.info(`[perf] ${label} ${Math.round(performance.now() - start)}ms`);
  }
}
