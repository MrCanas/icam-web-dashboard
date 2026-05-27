import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { PerfilPasswordForm } from "@/modules/account/ui/PerfilPasswordForm";

const ZONE_LABELS: Record<string, string> = {
  financiero: "Financiero",
  pm: "PM",
  adquisiciones: "Adquisiciones",
  data: "Data",
};

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <h1 className="text-xl font-semibold text-icam-900">Mi perfil</h1>
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-text-muted">Email</dt>
            <dd className="text-text-primary font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Nombre</dt>
            <dd className="text-text-primary">{user.name}</dd>
          </div>
        </dl>
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <h2 className="text-base font-semibold text-icam-900 mb-3">
          Zonas y permisos
        </h2>
        {user.zones.length === 0 ? (
          <p className="text-sm text-text-muted">Sin zonas asignadas.</p>
        ) : (
          <ul className="space-y-2">
            {user.zones.map((z) => (
              <li
                key={z.zone_key}
                className="flex items-center justify-between text-sm border border-subtle/40 rounded-md px-3 py-2"
              >
                <span className="text-text-primary">
                  {ZONE_LABELS[z.zone_key] ?? z.zone_key}
                </span>
                <span className="text-text-muted capitalize">{z.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-4 sm:p-5">
        <h2 className="text-base font-semibold text-icam-900 mb-1">
          Cambiar contraseña
        </h2>
        <p className="text-sm text-text-muted mb-4">
          Mínimo 8 caracteres. Tras el cambio, usa la nueva contraseña en el
          próximo inicio de sesión.
        </p>
        <PerfilPasswordForm />
      </section>
    </div>
  );
}
