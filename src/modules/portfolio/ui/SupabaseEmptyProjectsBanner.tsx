/**
 * Muestra si la query a `proyectos` devolvió 0 filas sin error (p. ej. RLS bloquea SELECT al rol `anon`).
 * No usar datos de demostración en silencio: ver `scripts/supabase/README-policies.md`.
 */
export function SupabaseEmptyProjectsBanner() {
  return (
    <section
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="alert"
    >
      <p className="font-medium text-amber-950">No hay datos de Supabase (0 proyectos)</p>
      <p className="mt-1 text-amber-900/90">
        El cliente anónimo no recibió filas de <code className="rounded bg-amber-100/80 px-1">proyectos</code>.
        Revisa las políticas RLS: hace falta <strong>SELECT</strong> para el rol <code>anon</code> (o el que use{" "}
        <code className="rounded bg-amber-100/80 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>). Guía:{" "}
        <code className="rounded bg-amber-100/80 px-1">scripts/supabase/README-policies.md</code>
      </p>
    </section>
  );
}
