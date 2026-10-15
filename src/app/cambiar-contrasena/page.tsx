import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { mustChangePassword } from "@/lib/auth/must-change-password";
import { CambiarContrasenaForm } from "@/app/cambiar-contrasena/CambiarContrasenaForm";

export const dynamic = "force-dynamic";

/**
 * Fuera de /dashboard a propósito: el layout del dashboard redirige aquí a
 * quien tiene el cambio pendiente, y desde dentro sería un bucle.
 */
export default async function CambiarContrasenaPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!(await mustChangePassword(user.id))) {
    redirect("/dashboard/portfolio");
  }

  return (
    <section className="min-h-screen min-w-0 bg-[#1c2e69] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[440px] bg-card rounded-lg border border-subtle/50 shadow-sm p-5 sm:p-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-icam-900">
            Cambia tu contraseña
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Por seguridad, tienes que elegir una contraseña nueva antes de
            seguir usando el portal. Mínimo 8 caracteres y distinta de la actual.
          </p>
        </div>
        <CambiarContrasenaForm />
        <form action="/api/auth/logout" method="post" className="text-center">
          <button
            type="submit"
            className="text-xs text-text-muted underline hover:text-text-body"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </section>
  );
}
