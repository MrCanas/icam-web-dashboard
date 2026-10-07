import { resolve4, resolve6, resolveMx } from "node:dns/promises";

/**
 * ¿Recibe correo este dominio? Se le pregunta al DNS.
 *
 * Sirve para cazar un dominio que no existe (`inversor.con`) antes de escribirle,
 * que acabaría en un rebote. Solo se da por malo lo que el DNS dice que es malo
 * con seguridad: si no contesta, o tarda, el dominio se da por bueno. Una caída
 * del DNS no puede dejar a media base sin correo.
 *
 * Solo servidor.
 */

const ESPERA_MS = 4000;
const A_LA_VEZ = 8;
/** Cuánto vale lo que contestó el DNS. Un dominio no cambia de un día para otro. */
const CACHE_MS = 24 * 60 * 60 * 1000;

function conEspera<T>(promesa: Promise<T>): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const espera = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("ETIMEOUT")), ESPERA_MS);
  });
  return Promise.race([promesa, espera]).finally(() => clearTimeout(temporizador));
}

function codigo(err: unknown): string {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
}

type Veredicto = "recibe" | "no_recibe" | "no_se_sabe";

async function comprobar(dominio: string): Promise<Veredicto> {
  try {
    const mx = await conEspera(resolveMx(dominio));
    // Un MX «.» es la forma de decir «este dominio no acepta correo» (RFC 7505).
    return mx.some((r) => r.exchange && r.exchange !== ".") ? "recibe" : "no_recibe";
  } catch (err) {
    const c = codigo(err);
    if (c !== "ENODATA" && c !== "ENOTFOUND") return "no_se_sabe";
    if (c === "ENOTFOUND") return "no_recibe"; // el dominio no existe
  }
  // Sin MX, el correo va a la dirección del propio dominio, si tiene.
  for (const resolver of [resolve4, resolve6]) {
    try {
      if ((await conEspera(resolver(dominio))).length > 0) return "recibe";
    } catch (err) {
      const c = codigo(err);
      if (c !== "ENODATA" && c !== "ENOTFOUND") return "no_se_sabe";
    }
  }
  return "no_recibe";
}

// Lo contestado, por dominio, mientras viva el proceso. Solo se guardan las
// respuestas seguras: un «no se sabe» se vuelve a preguntar la próxima vez.
const cache = new Map<string, { veredicto: Veredicto; hasta: number }>();

async function comprobarConCache(dominio: string): Promise<Veredicto> {
  const guardado = cache.get(dominio);
  if (guardado && guardado.hasta > Date.now()) return guardado.veredicto;
  const veredicto = await comprobar(dominio);
  if (veredicto !== "no_se_sabe") cache.set(dominio, { veredicto, hasta: Date.now() + CACHE_MS });
  return veredicto;
}

/**
 * De una lista de dominios, los que con seguridad no reciben correo.
 *
 * Pásale solo los dominios de quienes van a recibir el correo: cada dominio
 * nuevo son hasta tres consultas, y la base entera tarda minutos.
 */
export async function dominiosSinCorreo(dominios: Iterable<string>): Promise<Set<string>> {
  const pendientes = [...new Set([...dominios].map((d) => d.trim().toLowerCase()).filter(Boolean))];
  const malos = new Set<string>();
  const obrero = async () => {
    for (;;) {
      const dominio = pendientes.shift();
      if (!dominio) return;
      if ((await comprobarConCache(dominio)) === "no_recibe") malos.add(dominio);
    }
  };
  await Promise.all(Array.from({ length: A_LA_VEZ }, obrero));
  return malos;
}
