"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getHistoricoElementDetail } from "@/modules/pm/actas/actions/get-historico-element";
import { formatTimelineRange } from "@/modules/pm/actas/logic/element-display";
import {
  ELEMENT_STATUS_LABEL,
  ELEMENT_STATUS_STYLE,
} from "@/modules/pm/actas/logic/element-status";
import {
  actasElementPermalinkUrl,
  actasProjectHistoricoHubPath,
  actasProjectTabPath,
} from "@/modules/pm/actas/logic/actas-paths";
import {
  formatActaEntryDateTime,
  formatLogEntryDate,
} from "@/modules/pm/actas/logic/actas-time";
import {
  buildHistoricoTimelineItems,
  countDeletedEntries,
} from "@/modules/pm/actas/logic/historico-timeline";
import type { ActasHistoricoElementDetail } from "@/modules/pm/actas/types";

import { ActasOwnerAvatars } from "../operativo/ActasOwnerAvatars";
import { ActasHistoryEntryItem } from "../operativo/ActasHistoryEntryItem";
import { ActasHistoricoGapSeparator } from "./ActasHistoricoTimelineEntry";

interface ActasHistoricoElementViewProps {
  projectId: string;
  projectCode: string;
  elementId: string;
  currentAuthUserId: string | null;
  isPmAdmin: boolean;
  hasWriteAccess: boolean;
}

export function ActasHistoricoElementView({
  projectId,
  projectCode,
  elementId,
  currentAuthUserId,
  isPmAdmin,
  hasWriteAccess,
}: ActasHistoricoElementViewProps) {
  const router = useRouter();
  const [detail, setDetail] = useState<ActasHistoricoElementDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    setError(null);
    void getHistoricoElementDetail(projectId, elementId).then((res) => {
      setLoading(false);
      if (res.ok) {
        setDetail(res.detail);
        return;
      }
      if (res.notFound) {
        setNotFound(true);
        return;
      }
      setError(res.error);
    });
  }, [projectId, elementId]);

  const deletedCount = detail ? countDeletedEntries(detail.entries) : 0;

  const visibleEntries = useMemo(() => {
    if (!detail) return [];
    return detail.entries.filter(
      (e) => showDeleted || e.deletedAt == null,
    );
  }, [detail, showDeleted]);

  const timelineItems = useMemo(
    () => buildHistoricoTimelineItems(visibleEntries),
    [visibleEntries],
  );

  useEffect(() => {
    if (loading || !detail) return;
    const match = window.location.hash.match(/^#entry-(.+)$/);
    if (!match) return;
    const entryId = match[1]!;

    let highlightTimer: number | undefined;

    const scrollToEntry = () => {
      const el = document.getElementById(`entry-${entryId}`);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightEntryId(entryId);
      highlightTimer = window.setTimeout(() => setHighlightEntryId(null), 1000);
      return true;
    };

    const retryTimer = window.setTimeout(() => {
      if (!scrollToEntry()) {
        window.setTimeout(scrollToEntry, 200);
      }
    }, 50);

    return () => {
      window.clearTimeout(retryTimer);
      if (highlightTimer != null) window.clearTimeout(highlightTimer);
    };
  }, [loading, detail, timelineItems.length]);

  const activeCount = detail
    ? detail.entries.filter((e) => e.deletedAt == null).length
    : 0;

  const handleEntryUpdated = (updated: ActasHistoricoElementDetail["entries"][number]) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === updated.id ? updated : e,
        ),
      };
    });
  };

  const handleEntryDeleted = (deleted: ActasHistoricoElementDetail["entries"][number]) => {
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === deleted.id ? deleted : e,
        ),
      };
    });
    router.refresh();
  };

  const handleShare = async () => {
    const url = actasElementPermalinkUrl(
      projectCode,
      elementId,
      typeof window !== "undefined" ? window.location.origin : undefined,
    );
    try {
      await navigator.clipboard.writeText(url);
      setShareToast(true);
      window.setTimeout(() => setShareToast(false), 3000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <section className="bg-card rounded-b-lg border border-t-0 border-subtle/50 p-6 text-sm text-text-muted">
        Cargando histórico…
      </section>
    );
  }

  if (notFound) {
    return (
      <section className="bg-card rounded-b-lg border border-t-0 border-subtle/50 p-6">
        <p className="text-sm text-text-primary font-medium">
          Este elemento no pertenece a este proyecto.
        </p>
        <Link
          href={actasProjectHistoricoHubPath(projectCode)}
          className="mt-4 inline-flex min-h-10 items-center rounded-md bg-icam-900 px-4 text-sm font-medium text-white hover:bg-icam-800"
        >
          Volver al selector
        </Link>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="bg-card rounded-b-lg border border-t-0 border-red-200 p-6 text-sm text-red-700">
        {error ?? "Error al cargar el histórico"}
      </section>
    );
  }

  const { element, category, owners } = detail;
  const statusStyle = ELEMENT_STATUS_STYLE[element.status];
  const timeline = formatTimelineRange(
    element.timelineStart,
    element.timelineEnd,
  );

  return (
    <section className="bg-card rounded-b-lg border border-t-0 border-subtle/50 min-h-[320px]">
      <header className="border-b border-subtle/40 p-4 md:p-6 space-y-4">
        <nav
          className="flex flex-wrap items-center gap-1 text-xs text-text-muted"
          aria-label="Breadcrumb"
        >
          <Link
            href={actasProjectTabPath(projectCode, "operativo")}
            className="hover:text-icam-900 hover:underline"
          >
            Proyecto {projectCode}
          </Link>
          <span aria-hidden>›</span>
          <Link
            href={actasProjectTabPath(projectCode, "operativo")}
            className="hover:text-icam-900 hover:underline"
          >
            {category.displayName}
          </Link>
          <span aria-hidden>›</span>
          <span className="text-text-primary font-medium truncate max-w-[12rem]">
            {element.name}
          </span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-text-primary leading-snug">
              {element.name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span
                className="inline-flex rounded-md px-2 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                }}
              >
                {ELEMENT_STATUS_LABEL[element.status]}
              </span>
              {element.archivedAt ? (
                <span className="inline-flex rounded-md border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  Elemento archivado
                </span>
              ) : null}
              <ActasOwnerAvatars owners={owners} />
            </div>
            <dl className="mt-3 grid gap-1 text-xs text-text-muted sm:grid-cols-2">
              {timeline !== "—" ? (
                <div>
                  <dt className="inline font-medium">Planificación: </dt>
                  <dd className="inline">{timeline}</dd>
                </div>
              ) : null}
              <div>
                <dt className="inline font-medium">Creado: </dt>
                <dd className="inline">
                  {formatLogEntryDate(element.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="inline font-medium">Última actividad: </dt>
                <dd className="inline">
                  {element.lastActivityAt
                    ? formatActaEntryDateTime(element.lastActivityAt)
                    : "Sin actividad"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                router.push(actasProjectHistoricoHubPath(projectCode))
              }
              className="min-h-10 rounded-md border border-subtle/60 px-3 text-sm text-text-primary hover:bg-page"
            >
              Volver al selector
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="min-h-10 rounded-md border border-icam-900/30 bg-icam-900/5 px-3 text-sm font-medium text-icam-900 hover:bg-icam-900/10"
            >
              Compartir link
            </button>
          </div>
        </div>

        {deletedCount > 0 ? (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Mostrar entradas borradas ({deletedCount})
          </label>
        ) : null}
      </header>

      <div className="p-4 md:p-6">
        {activeCount === 0 && !showDeleted ? (
          <p className="rounded-md border border-dashed border-subtle/60 bg-page px-4 py-10 text-center text-sm text-text-muted">
            Este elemento aún no tiene actividad. Añade la primera entrada desde
            el tab Operativo.
          </p>
        ) : (
          <ul className="max-w-3xl space-y-3">
            {timelineItems.map((item, idx) =>
              item.kind === "gap" ? (
                <li key={`gap-${idx}`} className="list-none">
                  <ActasHistoricoGapSeparator days={item.days} />
                </li>
              ) : (
                <li
                  key={item.entry.id}
                  id={`entry-${item.entry.id}`}
                  className={`list-none scroll-mt-24 rounded-md transition-colors duration-300 ${
                    highlightEntryId === item.entry.id
                      ? "ring-2 ring-amber-300/60"
                      : ""
                  }`}
                >
                  <ActasHistoryEntryItem
                    entry={item.entry}
                    variant="card"
                    currentAuthUserId={currentAuthUserId}
                    isPmAdmin={isPmAdmin}
                    hasWriteAccess={hasWriteAccess}
                    onUpdated={handleEntryUpdated}
                    onDeleted={handleEntryDeleted}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {shareToast ? (
        <div
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-md border border-icam-900/20 bg-card px-4 py-2.5 text-sm font-medium text-icam-900 shadow-lg"
          role="status"
        >
          Link copiado
        </div>
      ) : null}
    </section>
  );
}
