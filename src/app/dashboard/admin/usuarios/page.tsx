import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { isPlatformAdmin } from "@/lib/auth/permissions";
import { firstAccessiblePath } from "@/lib/auth/zone-access";
import { listAdminUsers } from "@/modules/admin/data/adminUsersRepository";
import { AdminUsuariosPage } from "@/modules/admin/ui/pages/AdminUsuariosPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!isPlatformAdmin(user)) {
    redirect(firstAccessiblePath(user) ?? "/sin-acceso");
  }

  const users = await listAdminUsers();

  return <AdminUsuariosPage currentUserId={user.id} users={users} />;
}
