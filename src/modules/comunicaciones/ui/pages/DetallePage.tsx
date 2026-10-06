import Link from "next/link";

import type { UserContext } from "@/lib/auth/currentUser";
import { checkWriteAccess, getUserRole } from "@/lib/auth/permissions";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import { calcularProgreso } from "@/modules/comunicaciones/logic/envio";
import { loadDatosDeEnvios, loadDetalle } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_PATH, ZONA_COMUNICACIONES } from "@/modules/comunicaciones/logic/paths";
import { CancelarButton } from "@/modules/comunicaciones/ui/components/CancelarButton";
import { DestinatariosPanel } from "@/modules/comunicaciones/ui/components/DestinatariosPanel";
import { EnvioPanel } from "@/modules/comunicaciones/ui/components/EnvioPanel";
import { EstadoDeEnvios } from "@/modules/comunicaciones/ui/components/EstadoDeEnvios";
import { PlantillaPanel } from "@/modules/comunicaciones/ui/components/PlantillaPanel";
import {
  ESTADOS_EDITABLES,
  ETIQUETA_AUDIENCIA,
  ETIQUETA_ESTADO,
  ETIQUETA_ROL,
  ETIQUETA_TIPO,
} from "@/modules/comunicaciones/types";

function Cifra({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota?: string }) {
  return (
    <div className="rounded-lg border border-subtle/50 bg-card px-3 py-2">
      <dt className="text-xs text-text-muted">{etiqueta}</dt>
      <dd className="text-xl font-semibold tabular-nums text-text-primary">{fmtInt(valor)}</dd>
      {nota ? <dd className="text-xs text-text-muted">{nota}</dd> : null}
    </div>
  );
}

/**
 * Una comunicación: a quién iría, uno por uno, cómo queda la plantilla con los
 * datos de cada destinatario y, después, los pasos hasta enviarla.
 *
 * Los destinatarios son una foto tomada al preparar. No se recalculan solos: lo
 * que se revisa aquí es exactamente lo que después se envía.
 */
export default async function DetallePage({ ctx, id }: { ctx: UserContext; id: string }) {
  const [{ comunicacion, destinatarios, resumen, ajustes, error }, envios] = await Promise.all([
    loadDetalle(ctx, id),
    loadDatosDeEnvios(ctx),
  ]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6">
        <p className="rounded-lg border border-[#9B3B3B]/40 bg-card p-4 text-sm text-[#9B3B3B]">
          No se pudo leer la comunicación: {error}
        </p>
      </div>
    );
  }
  if (!comunicacion) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-3 py-4 sm:px-4 sm:py-6">
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">
          Esta comunicación no existe.{" "}
          <Link href={COMUNICACIONES_PATH} className="text-icam-900 underline">
            Volver al historial
          </Link>
        </p>
      </div>
    );
  }

  const puedeEscribir = checkWriteAccess(ctx, ZONA_COMUNICACIONES) === null;
  const editable = puedeEscribir && ESTADOS_EDITABLES.includes(comunicacion.estado);
  const roles = (lista: readonly (keyof typeof ETIQUETA_ROL)[]) =>
    lista.length > 0 ? lista.map((r) => ETIQUETA_ROL[r]).join(", ") : "nadie";
  const aEnviar = destinatarios.filter((d) => !d.excluido && d.para.length > 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-text-muted">
            <Link href={COMUNICACIONES_PATH} className="underline-offset-2 hover:underline">
              Comunicaciones
            </Link>{" "}
            / {ETIQUETA_ESTADO[comunicacion.estado]}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-2xl">{comunicacion.nombre}</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {ETIQUETA_TIPO[comunicacion.tipo]} ·{" "}
            {comunicacion.audiencia === "promocion" && comunicacion.promocion_nombre
              ? comunicacion.promocion_nombre
              : ETIQUETA_AUDIENCIA[comunicacion.audiencia]}{" "}
            · Para: {roles(comunicacion.roles_para)} · Copia: {roles(comunicacion.roles_copia)}
          </p>
          <p className="text-sm text-text-muted">
            Preparada el {fmtFechaHora(comunicacion.created_at)} por {comunicacion.creada_por_email} con
            los datos de Zoho del {fmtFechaHora(comunicacion.datos_zoho_at)}.
          </p>
        </div>
        {editable ? <CancelarButton comunicacionId={comunicacion.id} /> : null}
      </header>

      <EstadoDeEnvios datos={envios} />

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Cifra etiqueta="Correos que saldrían" valor={resumen.aEnviar} nota="uno por cuenta" />
        <Cifra
          etiqueta="Direcciones en Para"
          valor={resumen.direcciones}
          nota={`${fmtInt(resumen.direccionesExternas)} externas`}
        />
        <Cifra etiqueta="Excluidos" valor={resumen.excluidos} />
        <Cifra etiqueta="Sin destinatario" valor={resumen.sinDestinatario} nota="no recibirían nada" />
        <Cifra etiqueta="Cuentas en la lista" valor={resumen.total} />
      </dl>

      <DestinatariosPanel
        comunicacionId={comunicacion.id}
        nombre={comunicacion.nombre}
        destinatarios={destinatarios}
        dominiosInternos={ajustes?.dominios_internos ?? []}
        editable={editable}
      />

      <PlantillaPanel
        comunicacionId={comunicacion.id}
        plantillaId={comunicacion.plantilla_id}
        plantillaNombre={comunicacion.plantilla_nombre}
        destinatarios={aEnviar.map((d) => ({ id: d.id, nombre: d.cuenta_nombre }))}
        editable={editable}
      />

      {ajustes ? (
        <EnvioPanel
          comunicacion={comunicacion}
          resumen={resumen}
          ajustes={ajustes}
          rol={getUserRole(ctx, ZONA_COMUNICACIONES)}
          usuarioEmail={ctx.email}
          pasarela={envios.pasarela}
          progreso={calcularProgreso(destinatarios)}
          lineas={aEnviar.map((d) => `${d.cuenta_nombre} — ${d.para.map((p) => p.email).join(", ")}`)}
        />
      ) : null}
    </div>
  );
}
