import type { CorreoSaliente } from "@/modules/comunicaciones/logic/envio";
import type { NombrePasarela } from "@/modules/comunicaciones/types";

export type RespuestaPasarela = { ok: true; messageId: string } | { ok: false; error: string };

/** Lo único que sabe hacer una pasarela: intentar que salga un correo. */
export interface PasarelaCorreo {
  nombre: NombrePasarela;
  enviar(correo: CorreoSaliente): Promise<RespuestaPasarela>;
}

export type ResultadoEnvio =
  | { ok: true; messageId: string; pasarela: NombrePasarela }
  | {
      ok: false;
      error: string;
      pasarela: NombrePasarela;
      /** true = lo paró el candado; el correo no llegó a ninguna pasarela. */
      bloqueadoPorCandado: boolean;
    };
