"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { createCategory } from "@/modules/pm/actas/actions/create-category";
import { nextDefaultName } from "@/modules/pm/actas/logic/default-element-name";
import type { OperativoOptimisticAction } from "@/modules/pm/actas/logic/operativo-optimistic";

import { useInlineCreate } from "./ActasInlineCreateContext";

const DEFAULT_GROUP_NAME = "Nuevo grupo";

interface ActasAddGroupButtonProps {
  projectId: string;
  /** Nombres de grupos existentes, para generar un nombre por defecto único. */
  existingNames: string[];
  onOptimisticAction: (action: OperativoOptimisticAction) => void;
  onToast: (message: string) => void;
}

/**
 * Botón "+ Nuevo grupo" con creación inline: crea el grupo con un nombre por
 * defecto único, lo añade optimísticamente al final del tablero y deja su
 * título en modo edición con el foco (vía ActasInlineCreateContext).
 *
 * Vive dentro del provider de inline-create (lo renderiza el board), por eso
 * puede pedir la auto-edición del grupo recién creado.
 */
export function ActasAddGroupButton({
  projectId,
  existingNames,
  onOptimisticAction,
  onToast,
}: ActasAddGroupButtonProps) {
  const router = useRouter();
  const inlineCreate = useInlineCreate();
  const [pending, startTransition] = useTransition();

  const handleAddGroup = () => {
    if (pending) return;
    const name = nextDefaultName(DEFAULT_GROUP_NAME, existingNames);
    startTransition(async () => {
      const result = await createCategory({ projectId, name });
      if (!result.ok) {
        onToast(result.error || "No se pudo crear el grupo");
        return;
      }
      onOptimisticAction({
        type: "addCategory",
        categoryId: result.categoryId,
        name,
        displayName: name,
      });
      inlineCreate?.requestAutoEdit(result.categoryId);
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-subtle bg-card px-4 py-3 text-sm font-medium text-icam-900 hover:bg-icam-900/5 transition-colors disabled:opacity-50"
      onClick={handleAddGroup}
    >
      <span className="text-lg leading-none font-light" aria-hidden>
        +
      </span>
      {pending ? "Añadiendo…" : "Nuevo grupo"}
    </button>
  );
}
