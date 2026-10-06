import { normalizarEmail } from "@/modules/comunicaciones/logic/candado";
import type { CorreoSaliente } from "@/modules/comunicaciones/logic/envio";

/**
 * La huella de un correo: un resumen de todo lo que lo define.
 *
 * En el ensayo general se montan todos los correos sin enviar ninguno y se
 * guarda la huella de cada uno. Al enviar se vuelve a montar y se compara: si
 * algo ha cambiado entre medias —una dirección, el nombre en el saludo, la
 * plantilla, un adjunto—, la huella no coincide y ese correo no sale. Lo que se
 * envía es exactamente lo que se ensayó.
 *
 * Usa la criptografía estándar de la plataforma, así que vale igual en el
 * servidor y en las pruebas.
 */
export async function huellaDeCorreo(correo: CorreoSaliente): Promise<string> {
  const ordenadas = (lista: readonly string[]) => lista.map(normalizarEmail).sort();
  const canonico = JSON.stringify({
    registro: [correo.registro.modulo, correo.registro.id],
    remitente: normalizarEmail(correo.remitente),
    para: ordenadas(correo.para),
    copia: ordenadas(correo.copia),
    copiaOculta: ordenadas(correo.copiaOculta),
    plantilla: correo.plantillaId,
    asunto: correo.contenido?.asunto ?? null,
    html: correo.contenido?.html ?? null,
    adjuntos: correo.contenido?.adjuntos ?? [],
  });
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonico));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
