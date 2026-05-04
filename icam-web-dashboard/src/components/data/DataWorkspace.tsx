"use client";

import { useState } from "react";
import { ActivityLog } from "@/components/data/ActivityLog";
import { DataUpload } from "@/components/data/DataUpload";

type TabId = "upload" | "activity";

export function DataWorkspace() {
  const [tab, setTab] = useState<TabId>("upload");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            tab === "upload"
              ? "bg-icam-900 text-white"
              : "bg-subtle text-icam-900 hover:bg-subtle/80"
          }`}
        >
          Subir datos
        </button>
        <button
          type="button"
          onClick={() => setTab("activity")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            tab === "activity"
              ? "bg-icam-900 text-white"
              : "bg-subtle text-icam-900 hover:bg-subtle/80"
          }`}
        >
          Actividad
        </button>
      </div>

      {tab === "upload" ? <DataUpload /> : <ActivityLog />}
    </div>
  );
}
