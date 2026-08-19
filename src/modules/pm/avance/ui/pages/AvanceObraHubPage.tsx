import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { fetchAvanceHubData } from "@/modules/pm/avance/data/avanceRepository";
import { zohoVariablesQueFaltan } from "@/modules/pm/avance/data/zohoClient";
import { avanceObraExportPath, avanceObraProyectoPath } from "@/modules/pm/avance/logic/avance-paths";
import { fmtPorcentaje } from "@/modules/pm/avance/logic/avance-obra";
import { EnviarAZohoButton } from "@/modules/pm/avance/ui/components/EnviarAZohoButton";
import { ZohoOutboxTable } from "@/modules/pm/avance/ui/components/ZohoOutboxTable";

export default async function AvanceObraHubPage() {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        No autorizado
      </section>
    );
  }

  const { pendientes, aprobados, promociones, migracionPendiente, error } =
    await fetchAvanceHubData(ctx);

  if (migracionPendiente) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Avance de obra necesita la migración 028, que aún no está aplicada en este entorno.
      </section>
    );
  }
  if (error) {
    return (
      <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
        Error cargando Avance de obra: {error}
      </section>
    );
  }

  const isAdmin = getUserRole(ctx, "pm") === "admin";
  const faltanVariables = zohoVariablesQueFaltan();
  const sinVincular = promociones.filter((p) => p.idsActivo.length === 0).length;
  const porTipologia = promociones.reduce<Record<string, number>>((acc, p) => {
    const k = p.tipoProyecto ?? "Sin tipología";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-w-0 space-y-6">
      <header className="rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-text-primary">Avance de obra</h1>
        <p className="mt-1 text-sm text-text-muted">
          Porcentaje de ejecución por fase, con origen en el módulo Promociones de Zoho CRM.
        </p>
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-800">
          <span className="font-medium">Nada se envía a Zoho automáticamente.</span> Lo que se
          edita en el portal queda aquí hasta que un administrador lo aprueba, y sale hacia Zoho
          solo cuando alguien pulsa «Subir a Zoho». No hay ningún proceso que escriba por su
          cuenta.
          {faltanVariables.length > 0 ? (
            <>
              {" "}
              La conexión por API todavía no está configurada (faltan{" "}
              {faltanVariables.join(", ")}), así que de momento se descarga el CSV y se sube desde
              Zoho.
            </>
          ) : null}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text-primary">
          Cambios pendientes de aprobar{pendientes.length > 0 ? ` (${pendientes.length})` : ""}
        </h2>
        <ZohoOutboxTable filas={pendientes} modo="pendiente" isAdmin={isAdmin} />
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">
            Aprobados, a la espera de subirse a Zoho
            {aprobados.length > 0 ? ` (${aprobados.length})` : ""}
          </h2>
          {aprobados.length > 0 ? (
            <span className="flex gap-2 text-xs">
              <a
                href={avanceObraExportPath("csv")}
                className="rounded border border-icam-900/30 bg-icam-900/[0.06] px-2 py-1 font-medium text-icam-900 hover:bg-icam-900/10"
              >
                Descargar CSV
              </a>
              <a
                href={avanceObraExportPath("json")}
                className="rounded border border-subtle px-2 py-1 text-text-muted hover:bg-page"
                title="Cuerpo de un bulk update de la API de Zoho. Marca los campos cuyo nombre API aún no conocemos."
              >
                Descargar JSON
              </a>
            </span>
          ) : null}
        </div>

        <EnviarAZohoButton
          pendientes={aprobados.length}
          isAdmin={isAdmin}
          faltanVariables={faltanVariables}
        />
        <ZohoOutboxTable filas={aprobados} modo="aprobado" isAdmin={isAdmin} />
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Promociones de Zoho ({promociones.length})
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-text-muted">
            Zoho tiene más promociones que proyectos hay en PM, y los códigos no coinciden entre
            los dos sistemas, así que el emparejamiento se hace a mano en{" "}
            <Link href="/dashboard/pm/proyectos" className="font-medium text-icam-900 underline">
              Mapeo maestro
            </Link>
            .{sinVincular > 0 ? ` ${sinVincular} sin vincular a ningún proyecto de PM.` : ""}
          </p>
          <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {Object.entries(porTipologia).map(([tipo, n]) => (
              <span
                key={tipo}
                className="rounded border border-subtle bg-page px-1.5 py-0.5 text-text-muted"
              >
                {tipo}: <span className="font-medium text-text-body">{n}</span>
              </span>
            ))}
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-subtle/50 bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-subtle/30">
              <tr>
                <th className="p-3 font-semibold text-icam-900">Código</th>
                <th className="p-3 font-semibold text-icam-900">Nombre</th>
                <th className="p-3 font-semibold text-icam-900">Tipología</th>
                <th className="p-3 font-semibold text-icam-900">Situación</th>
                <th className="p-3 font-semibold text-icam-900">Avance general</th>
                <th className="p-3 font-semibold text-icam-900">Proyecto de PM</th>
              </tr>
            </thead>
            <tbody>
              {promociones.map((p) => (
                <tr key={p.id} className="border-t border-subtle/50">
                  <td className="p-3 font-medium text-text-body">
                    {p.codigo}
                    {p.pendientes > 0 ? (
                      <span className="ml-1.5 rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                        {p.pendientes} pend.
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3 text-text-muted">
                    {p.nombre ?? "—"}
                    {p.direccion && p.direccion !== p.nombre ? (
                      <span className="block text-xs text-text-muted/80">{p.direccion}</span>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <span className="rounded bg-subtle px-1.5 py-0.5 text-xs text-text-muted">
                      {p.tipoProyecto ?? "—"}
                    </span>
                  </td>
                  <td className="p-3 text-text-muted">{p.situacion ?? "—"}</td>
                  <td className="p-3 tabular-nums text-text-body">{fmtPorcentaje(p.general)}</td>
                  <td className="p-3">
                    {p.idsActivo.length === 0 ? (
                      <span className="text-text-muted">— sin vincular —</span>
                    ) : (
                      p.idsActivo.map((id, i) => (
                        <span key={id}>
                          {i > 0 ? ", " : null}
                          <Link
                            href={avanceObraProyectoPath(id)}
                            className="text-icam-900 underline"
                          >
                            {id}
                          </Link>
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
