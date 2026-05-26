"use client";

import { useSearchParams } from "next/navigation";

import { ActasHistoricoElementView } from "./ActasHistoricoElementView";
import { ActasHistoricoHub } from "./ActasHistoricoHub";

interface ActasHistoricoTabProps {
  projectId: string;
  projectCode: string;
}

export function ActasHistoricoTab({
  projectId,
  projectCode,
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
    />
  );
}
