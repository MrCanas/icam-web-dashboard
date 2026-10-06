/**
 * Comprobaciones sobre una dirección de correo, antes de que entre en una lista.
 *
 * Las direcciones salen del CRM, donde alguien las tecleó a mano. Aquí no se
 * arregla ninguna: lo que está mal se señala y no entra, para que se corrija en
 * el CRM y no en silencio.
 *
 * Puro. Si el dominio recibe correo o no se pregunta fuera (`data/dns.ts`).
 */

/**
 * Sintaxis estricta: una sola `@`, sin espacios, dominio con punto y con
 * extensión de letras. Más estrecha que la norma a propósito: una dirección
 * rara pero legal es casi siempre una errata.
 */
const EMAIL_RE =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9_%+-])?@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}$/;

export function esEmailValido(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (e.length > 254 || e.includes("..")) return false;
  return EMAIL_RE.test(e);
}

export function dominioDe(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/** Erratas habituales de los dominios más comunes, y a qué se parecen. */
const ERRATAS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hormail.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "icloud.co": "icloud.com",
  "iclod.com": "icloud.com",
  "telefonica.ne": "telefonica.net",
};

/** El dominio al que se parece, si el de la dirección es una errata conocida. */
export function posibleErrata(email: string): string | null {
  return ERRATAS[dominioDe(email)] ?? null;
}
