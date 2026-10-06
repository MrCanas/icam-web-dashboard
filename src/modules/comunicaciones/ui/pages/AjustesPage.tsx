import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { puedeCambiarAjustes } from "@/modules/comunicaciones/logic/controles";
import { loadDatosDeEnvios } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_PATH, ZONA_COMUNICACIONES } from "@/modules/comunicaciones/logic/paths";
import { AjustesForm } from "@/modules/comunicaciones/ui/components/AjustesForm";
import { EstadoDeEnvios } from "@/modules/comunicaciones/ui/components/EstadoDeEnvios";

/**
 * Ajustes de envío: el interruptor general, el modo, la cuenta de pruebas y los
 * remitentes.
 *
 * Los ve cualquiera con la zona, porque explican por qué un envío sale o no. Los
 * cambia solo un administrador de la zona.
 */
export default async function AjustesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const datos = await loadDatosDeEnvios(user);
  const sinPermiso = puedeCambiarAjustes(getUserRole(user, ZONA_COMUNICACIONES));

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      <header>
        <p className="text-sm text-text-muted">
          <Link href={COMUNICACIONES_PATH} className="underline-offset-2 hover:underline">
            Comunicaciones
          </Link>{" "}
          / Ajustes
        </p>
        <h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-2xl">Ajustes de envío</h1>
      </header>

      <EstadoDeEnvios datos={datos} conEnlace={false} />

      {sinPermiso ? (
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">{sinPermiso}</p>
      ) : datos.ajustes ? (
        <AjustesForm ajustes={datos.ajustes} cuentasDePrueba={datos.cuentasPermitidas} />
      ) : null}
    </div>
  );
}
