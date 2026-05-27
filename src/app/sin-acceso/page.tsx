import Link from "next/link";

export default function SinAccesoPage() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center bg-page px-4">
      <div className="max-w-md w-full bg-card rounded-lg border border-subtle/50 shadow-sm p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold text-icam-900">Sin acceso al portal</h1>
        <p className="text-sm text-text-muted">
          Tu cuenta no tiene ninguna zona asignada. Contacta con un administrador
          para que te conceda permisos.
        </p>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-icam-900 px-4 text-sm font-medium text-white hover:bg-icam-800 transition"
          >
            Cerrar sesión
          </button>
        </form>
        <p className="text-xs text-text-muted">
          <Link href="/login" className="underline hover:text-text-body">
            Volver al login
          </Link>
        </p>
      </div>
    </section>
  );
}
