import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { loadNueva } from "@/modules/comunicaciones/logic/loadComunicaciones";
import { COMUNICACIONES_PATH, ZONA_COMUNICACIONES } from "@/modules/comunicaciones/logic/paths";
import { AvisoSinEnvio } from "@/modules/comunicaciones/ui/components/AvisoSinEnvio";
import { NuevaForm } from "@/modules/comunicaciones/ui/components/NuevaForm";

/**
 * Nueva comunicación: a quién va dirigida.
 *
 * Enseña cuántas cuentas tiene cada audiencia ANTES de elegirla y de qué hora
 * son los datos. Al terminar no se envía nada: se guarda la lista y se pasa a
 * revisarla.
 */
export default async function NuevaPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const sinEscritura = checkWriteAccess(user, ZONA_COMUNICACIONES);
  const { recuento, datosZohoAt, sinMigracion, error } = await loadNueva(user);

  return (
    <div className="mx-auto w-full max-w-[900px] space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      <header>
        <p className="text-sm text-text-muted">
          <Link href={COMUNICACIONES_PATH} className="underline-offset-2 hover:underline">
            Comunicaciones
          </Link>{" "}
          / Nueva
        </p>
        <h1 className="mt-1 text-xl font-semibold text-text-primary sm:text-2xl">Nueva comunicación</h1>
      </header>

      <AvisoSinEnvio />

      {sinMigracion ? (
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">
          Las tablas de Inversores no existen todavía en la base de datos (migración{" "}
          <code>040_inversores</code>).
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[#9B3B3B]/40 bg-card p-4 text-sm text-[#9B3B3B]">
          No se pudieron leer los datos: {error}
        </p>
      ) : null}

      {sinEscritura ? (
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">
          Tu rol en Comunicaciones es de lectura: puedes ver el historial, pero no preparar
          comunicaciones.
        </p>
      ) : !sinMigracion && !error ? (
        <NuevaForm recuento={recuento} datosZohoAt={datosZohoAt} />
      ) : null}
    </div>
  );
}
