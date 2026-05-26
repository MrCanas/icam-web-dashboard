import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchActasProjects } from "@/modules/pm/actas/data/actasRepository";
import { ActasShell } from "@/modules/pm/actas/ui/components/ActasShell";

export const dynamic = "force-dynamic";

export default async function ActasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    redirect("/login");
  }

  const { projects, error } = await fetchActasProjects(ctx);

  return (
    <ActasShell projects={projects} loadError={error}>
      {children}
    </ActasShell>
  );
}
