"use client";

import { useSearchParams } from "next/navigation";

import { ActasHistoricoElementView } from "./ActasHistoricoElementView";
import { ActasHistoricoHub } from "./ActasHistoricoHub";

interface ActasHistoricoTabProps {
  projectId: string;
  projectCode: string;
  currentAuthUserId: string | null;
  isPmAdmin: boolean;
  hasWriteAccess: boolean;
}

export function ActasHistoricoTab({
  projectId,
  projectCode,
  currentAuthUserId,
  isPmAdmin,
  hasWriteAccess,
}: ActasHistoricoTabProps) {
  const searchParams = useSearchParams();
  const elementId = searchParams.get("element")?.trim() ?? "";

  if (!elementId) {
    return (
      <ActasHistoricoHub projectId={projectId} projectCode={projectCode} />
    );
  }

  return (
    <ActasHistoricoElementView
      projectId={projectId}
      projectCode={projectCode}
      elementId={elementId}
      currentAuthUserId={currentAuthUserId}
      isPmAdmin={isPmAdmin}
      hasWriteAccess={hasWriteAccess}
    />
  );
}
