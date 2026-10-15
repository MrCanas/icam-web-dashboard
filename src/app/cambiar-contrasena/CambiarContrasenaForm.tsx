"use client";

import { useRouter } from "next/navigation";

import { PerfilPasswordForm } from "@/modules/account/ui/PerfilPasswordForm";

export function CambiarContrasenaForm() {
  const router = useRouter();
  return (
    <PerfilPasswordForm
      onChanged={() => {
        router.replace("/dashboard/portfolio");
        router.refresh();
      }}
    />
  );
}
