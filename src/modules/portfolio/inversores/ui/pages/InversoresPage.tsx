import { getCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { fmtFechaHora } from "@/lib/formatters";
import { loadInversoresPage } from "@/modules/portfolio/inversores/logic/loadInversoresPage";
import { InversoresTablero } from "@/modules/portfolio/inversores/ui/InversoresTablero";
import { SincronizarButton } from "@/modules/portfolio/inversores/ui/components/SincronizarButton";

/**
 * Inversores: quién ha puesto el dinero, cuánto, dónde y con qué flujos.
 *
 * Todo se lee del espejo en Supabase, no de Zoho en vivo: la pestaña abre a
 * velocidad de consulta y no gasta crédito de API por visita. Lo que se paga a
 * cambio es que el dato tiene la edad del último sync, así que la edad se
 * enseña siempre, arriba, en vez de dejar que el usuario la suponga.
 */
export default async function InversoresPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { modelo, sync, sinMigracion, error } = await loadInversoresPage(user);
  const puedeSincronizar = checkWriteAccess(user, "financiero") === null;

  const ultimo = sync.ultimo;
  const malSync = ultimo && (ultimo.estado === "parcial" || ultimo.estado === "error");

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Inversores</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {sync.ultimoOk
              ? `Datos de Zoho CRM · última sincronización correcta el ${fmtFechaHora(sync.ultimoOk)}`
              : "Datos de Zoho CRM · todavía sin ninguna sincronización correcta"}
          </p>
        </div>
        {puedeSincronizar ? <SincronizarButton /> : null}
      </header>

      {sinMigracion ? (
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">
          Las tablas de Inversores no existen todavía en la base de datos. Falta aplicar la
          migración <code>040_inversores</code>.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-[#9B3B3B]/40 bg-card p-4 text-sm text-[#9B3B3B]">
          No se pudieron leer los datos: {error}
        </p>
      ) : null}

      {malSync ? (
        <p className="rounded-lg border border-subtle bg-card p-4 text-sm text-text-body">
          La última sincronización ({fmtFechaHora(ultimo.iniciado_at)}) terminó como{" "}
          <strong>{ultimo.estado}</strong>
          {ultimo.error ? `: ${ultimo.error}` : "."} Lo que se ve abajo es la última carga buena de
          cada módulo.
          {ultimo.modulos.some((m) => m.error) ? (
            <span className="mt-1 block text-text-muted">
              Módulos con problema:{" "}
              {ultimo.modulos
                .filter((m) => m.error)
                .map((m) => `${m.modulo} (${m.error})`)
                .join(" · ")}
            </span>
          ) : null}
        </p>
      ) : null}

      <InversoresTablero modelo={modelo} />
    </div>
  );
}
