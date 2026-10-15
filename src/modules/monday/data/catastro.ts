// Referencia catastral a partir de la dirección de Monday, con el callejero
// público del Catastro (sin clave). Solo sirve para direcciones con calle y
// número; si no la encuentra devuelve null y la tarjeta abre el buscador.

const CALLEJERO =
  "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCallejero.asmx/Consulta_DNPLOC";

/** Siglas de vía del Catastro para el primer término de la dirección. */
const SIGLAS: Record<string, string> = {
  calle: "CL",
  c: "CL",
  avenida: "AV",
  av: "AV",
  avda: "AV",
  plaza: "PZ",
  paseo: "PS",
  camino: "CM",
  carretera: "CR",
  ronda: "RD",
  glorieta: "GL",
  travesia: "TR",
};

export interface DireccionCatastro {
  provincia: string;
  municipio: string;
  sigla: string;
  calle: string;
  numero: string;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * «Calle Caños del Peral 11, Madrid, España» → CL / CAÑOS DEL PERAL / 11 / MADRID.
 * Con tres tramos o más, el penúltimo es el municipio y el último la provincia.
 */
export function parseDireccion(loc: string): DireccionCatastro | null {
  const parts = loc
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  while (parts.length > 1 && /^(españa|spain)$/i.test(parts[parts.length - 1]!)) parts.pop();
  if (parts.length < 2 || /portugal/i.test(loc)) return null;

  // El número puede ir pegado a la calle («Calle Somera 9») o en su propio tramo («Calle Huesca, 21»).
  let via = parts[0]!;
  let numero = via.match(/\s(\d+)\b/)?.[1] ?? null;
  let resto = parts.slice(1);
  if (numero) via = via.slice(0, via.search(/\s\d+\b/));
  else if (/^\d+$/.test(resto[0] ?? "")) {
    numero = resto[0]!;
    resto = resto.slice(1);
  }
  if (!numero || resto.length === 0) return null;

  const palabras = via.split(/\s+/);
  const sigla = SIGLAS[sinTildes(palabras[0]!.toLowerCase()).replace(/\.$/, "")];
  const nombre = (sigla ? palabras.slice(1) : palabras).join(" ").replace(/\s*\/.*$/, "");
  const municipio = resto.length >= 2 ? resto[resto.length - 2]! : resto[0]!;
  const provincia = resto[resto.length - 1]!;
  return {
    provincia: provincia.toUpperCase(),
    municipio: municipio.toUpperCase(),
    sigla: sigla ?? "CL",
    calle: nombre.toUpperCase(),
    numero,
  };
}

async function consulta(d: DireccionCatastro, calle: string): Promise<string | null> {
  const params = new URLSearchParams({
    Provincia: d.provincia,
    Municipio: d.municipio,
    Sigla: d.sigla,
    Calle: calle,
    Numero: d.numero,
    Bloque: "",
    Escalera: "",
    Planta: "",
    Puerta: "",
  });
  const res = await fetch(`${CALLEJERO}?${params}`, {
    signal: AbortSignal.timeout(5000),
    next: { revalidate: 60 * 60 * 24 * 30 },
  });
  if (!res.ok) return null;
  const xml = await res.text();
  const pc1 = xml.match(/<pc1>(\w{7})<\/pc1>/)?.[1];
  const pc2 = xml.match(/<pc2>(\w{7})<\/pc2>/)?.[1];
  return pc1 && pc2 ? pc1 + pc2 : null;
}

/** Referencia catastral de la parcela (14 caracteres) o null. Nunca lanza. */
export async function buscarReferenciaCatastral(loc: string): Promise<string | null> {
  const d = parseDireccion(loc);
  if (!d) return null;
  // El Catastro guarda «CAÑOS DEL PERAL» pero «ZENIT» (sin «del»), y en
  // «Aravaca; Madrid» el municipio es Madrid: se prueban las variantes.
  const calles = [...new Set([d.calle, d.calle.replace(/^(DE LA|DE LOS|DE LAS|DEL|DE)\s+/, "")])];
  const municipios = [...new Set([d.municipio, d.provincia])];
  try {
    for (const municipio of municipios)
      for (const calle of calles) {
        const rc = await consulta({ ...d, municipio }, calle);
        if (rc) return rc;
      }
    return null;
  } catch (error) {
    console.warn("[adquisiciones] catastro lookup failed", { loc, error });
    return null;
  }
}
