/**
 * Los dos estados en los que el tab no tiene nada que pintar. Separados de las
 * páginas porque ambas los usan igual y porque el mensaje de «sin datos» tiene
 * que decir cómo se arregla: la primera carga del maestro corporativo se hace a
 * mano, y sin esa pista la pantalla vacía no se distingue de una avería.
 */

export function ErrorCorporativo({ mensaje }: { mensaje: string }) {
  return (
    <section className="rounded-lg border border-red-200 bg-card p-6 text-red-700">
      {mensaje}
    </section>
  );
}

export function CorporativoVacio() {
  return (
    <section className="rounded-lg border border-icam-gold/40 bg-card p-6">
      <h2 className="text-base font-semibold text-text-primary">
        Todavía no hay datos corporativos
      </h2>
      <p className="mt-2 text-sm text-text-body">
        La tabla <code className="rounded bg-page px-1">corp_periodos</code> está vacía. Se llena
        con el maestro corporativo, que llega por dos vías:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-body">
        <li>
          La sincronización semanal desde SharePoint (miércoles a las 10:00), o el botón de
          sincronizar de la pestaña <strong>Datos</strong>.
        </li>
        <li>
          Desde el Excel local:{" "}
          <code className="rounded bg-page px-1">npm run corporativo:sync-maestro</code>
        </li>
      </ul>
      <p className="mt-2 text-sm text-text-muted">
        Si la sincronización está fallando, el aviso y el motivo salen en la pestaña Datos.
      </p>
    </section>
  );
}
