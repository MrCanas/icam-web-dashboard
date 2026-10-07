import { randomUUID } from "node:crypto";

import type { PasarelaCorreo } from "@/modules/comunicaciones/data/pasarela/tipos";

/** Los identificadores de un envío simulado empiezan así, para que no se confundan con uno de Zoho. */
export const PREFIJO_SIMULADO = "simulado:";

/**
 * La pasarela que no envía nada.
 *
 * Es la que se usa donde no existe el token de envíos: en local y en las
 * previsualizaciones. No llama a Zoho ni a nadie; contesta que el correo «salió»
 * para que el recorrido completo se pueda probar, y lo que se guarda queda
 * marcado como simulado.
 */
export const pasarelaSimulada: PasarelaCorreo = {
  nombre: "simulada",
  async enviar() {
    return { ok: true, messageId: `${PREFIJO_SIMULADO}${randomUUID()}` };
  },
};
