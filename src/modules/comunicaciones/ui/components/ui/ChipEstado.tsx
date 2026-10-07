import { Chip, type TonoChip } from "@/components/ui/Chip";
import {
  ETIQUETA_AVISO,
  ETIQUETA_ESTADO,
  ETIQUETA_ESTADO_ENVIO,
  type Aviso,
  type EstadoComunicacion,
  type EstadoEnvio,
  type ModoEnvio,
  type NombrePasarela,
} from "@/modules/comunicaciones/types";

/**
 * Los estados del módulo como chips, con el tono fijo del portal: neutro =
 * preparación, oro = hito, verde = hecho, ámbar = en curso o atención, rojo =
 * bloquea o es delicado.
 */

const TONO_ESTADO: Record<EstadoComunicacion, TonoChip> = {
  borrador: "neutro",
  revisada: "neutro",
  probada: "marca",
  enviando: "aviso",
  pausada: "aviso",
  enviada: "ok",
  cancelada: "error",
};

export function ChipEstadoComunicacion({ estado, pasarela }: { estado: EstadoComunicacion; pasarela?: NombrePasarela | null }) {
  return (
    <>
      <Chip tono={TONO_ESTADO[estado]} pulso={estado === "enviando"} punto={estado === "pausada"}>
        {ETIQUETA_ESTADO[estado]}
      </Chip>
      {pasarela === "simulada" && ["enviando", "pausada", "enviada"].includes(estado) ? (
        <Chip tono="neutro" title="Salió por la pasarela simulada: no se envió ningún correo de verdad">
          simulada
        </Chip>
      ) : null}
    </>
  );
}

const TONO_ENVIO: Record<EstadoEnvio, TonoChip> = {
  pendiente: "neutro",
  sin_destinatario: "neutro",
  enviando: "aviso",
  enviado: "ok",
  error: "error",
  omitido: "neutro",
};

export function ChipEstadoEnvio({ estado, texto }: { estado: EstadoEnvio; texto?: string }) {
  return (
    <Chip tono={TONO_ENVIO[estado]} pulso={estado === "enviando"}>
      {texto ?? ETIQUETA_ESTADO_ENVIO[estado]}
    </Chip>
  );
}

export function ChipModo({ modo }: { modo: ModoEnvio }) {
  return modo === "real" ? (
    <Chip tono="error" punto title="Los correos van a las direcciones de la lista. El candado de destinatarios sigue mandando">
      Modo real
    </Chip>
  ) : (
    <Chip tono="neutro" title="Todo correo se redirige a quien lo envía, sea cual sea la lista">
      Modo pruebas
    </Chip>
  );
}

export function ChipPasarela({ pasarela }: { pasarela: NombrePasarela }) {
  return pasarela === "zoho" ? (
    <Chip tono="marca" title="Los correos salen de verdad, por Zoho CRM">
      Salen por Zoho
    </Chip>
  ) : (
    <Chip tono="neutro" title="En este entorno no sale ningún correo, aunque el recorrido se complete">
      Pasarela simulada
    </Chip>
  );
}

export function ChipEnvios({ activados }: { activados: boolean }) {
  return activados ? (
    <Chip tono="ok" punto>
      Envíos activados
    </Chip>
  ) : (
    <Chip tono="error" title="No sale ningún correo, ni de prueba, y un envío en curso se para antes del siguiente">
      Envíos desactivados
    </Chip>
  );
}

const TONO_AVISO: Partial<Record<Aviso, TonoChip>> = {
  dado_de_baja: "error",
  sin_correo: "error",
  direccion_mal_formada: "error",
  dominio_sin_correo: "error",
  direccion_nueva: "error",
  sin_destinatario: "aviso",
  posible_errata: "aviso",
  persona_repetida: "aviso",
  cuenta_de_prueba: "neutro",
  direccion_interna: "neutro",
};

export function ChipAviso({ aviso }: { aviso: Aviso }) {
  return <Chip tono={TONO_AVISO[aviso] ?? "aviso"}>{ETIQUETA_AVISO[aviso]}</Chip>;
}
