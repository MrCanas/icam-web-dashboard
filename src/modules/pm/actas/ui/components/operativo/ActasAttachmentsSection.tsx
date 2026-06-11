"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "@/modules/pm/actas/attachments/actions";
import {
  validateAttachmentFile,
  type ActasAttachmentItem,
} from "@/modules/pm/actas/attachments/types";
import { OPERATIVO_BOARD_MIN_WIDTH_PX } from "@/modules/pm/actas/logic/element-display";

interface ActasAttachmentsSectionProps {
  elementId: string;
  indentPx: number;
  hasWriteAccess: boolean;
  readOnly?: boolean;
  reloadNonce: number;
  onCountChange?: (count: number) => void;
  onError?: (message: string) => void;
}

export function ActasAttachmentsSection({
  elementId,
  indentPx,
  hasWriteAccess,
  readOnly = false,
  reloadNonce,
  onCountChange,
  onError,
}: ActasAttachmentsSectionProps) {
  const canEdit = hasWriteAccess && !readOnly;
  const [items, setItems] = useState<ActasAttachmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [lightbox, setLightbox] = useState<ActasAttachmentItem | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listAttachments(elementId);
    setLoading(false);
    if (!res.ok) {
      onError?.(res.error);
      return;
    }
    setItems(res.attachments);
    onCountChange?.(res.attachments.length);
  }, [elementId, onError, onCountChange]);

  useEffect(() => {
    void load();
  }, [load, reloadNonce]);

  const uploadFiles = (files: File[]) => {
    if (!canEdit || files.length === 0) return;
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      onError?.("Solo se permiten imágenes.");
      return;
    }
    for (const file of images) {
      const error = validateAttachmentFile({ type: file.type, size: file.size });
      if (error) {
        onError?.(error);
        return;
      }
    }
    startTransition(async () => {
      for (const file of images) {
        const fd = new FormData();
        fd.set("elementId", elementId);
        fd.set("file", file);
        const result = await uploadAttachment(fd);
        if (!result.ok) {
          onError?.(result.error);
          return;
        }
      }
      await load();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteAttachment(id);
      if (!result.ok) {
        onError?.(result.error);
        return;
      }
      setConfirmId(null);
      await load();
    });
  };

  return (
    <div
      className="border-b border-subtle/50 bg-page/40"
      style={{ paddingLeft: indentPx + 16, paddingRight: 16 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="py-2"
        style={{ minWidth: OPERATIVO_BOARD_MIN_WIDTH_PX - indentPx - 32 }}
        tabIndex={canEdit ? 0 : undefined}
        onPaste={
          canEdit
            ? (e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.some((f) => f.type.startsWith("image/"))) {
                  e.preventDefault();
                  uploadFiles(files);
                }
              }
            : undefined
        }
        onDragOver={
          canEdit
            ? (e) => {
                e.preventDefault();
                setDragOver(true);
              }
            : undefined
        }
        onDragLeave={canEdit ? () => setDragOver(false) : undefined}
        onDrop={
          canEdit
            ? (e) => {
                e.preventDefault();
                setDragOver(false);
                uploadFiles(Array.from(e.dataTransfer.files));
              }
            : undefined
        }
      >
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Adjuntos {items.length > 0 ? `(${items.length})` : ""}
          </p>
          {pending ? (
            <span className="text-[10px] text-text-muted">Subiendo…</span>
          ) : null}
        </div>

        {loading ? (
          <p className="text-xs text-text-muted">Cargando adjuntos…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-text-muted italic">
            {canEdit
              ? "Sin adjuntos. Pega (Ctrl+V) o arrastra una imagen aquí, o usa el clip."
              : "Sin adjuntos."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="group/att relative h-20 w-20 overflow-hidden rounded-md border border-subtle/60 bg-card"
              >
                {item.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.signedUrl}
                    alt={item.fileName}
                    className="h-full w-full cursor-zoom-in object-cover"
                    onClick={() => setLightbox(item)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[9px] text-text-muted">
                    sin vista
                  </div>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover/att:flex hover:bg-red-600"
                    aria-label={`Eliminar ${item.fileName}`}
                    onClick={() => setConfirmId(item.id)}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {dragOver ? (
          <p className="mt-1 text-[10px] text-icam-900">Suelta para adjuntar…</p>
        ) : null}
      </div>

      {confirmId && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setConfirmId(null)}
            >
              <div
                className="w-full max-w-xs rounded-lg border border-subtle/60 bg-card p-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm text-text-body">
                  ¿Eliminar este adjunto? Esta acción no se puede deshacer.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:bg-page"
                    onClick={() => setConfirmId(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    onClick={() => handleDelete(confirmId)}
                  >
                    {pending ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {lightbox && lightbox.signedUrl && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black/80 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={lightbox.fileName}
              onClick={() => setLightbox(null)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox.signedUrl}
                alt={lightbox.fileName}
                className="max-h-[85vh] max-w-[90vw] rounded object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <div
                className="mt-3 flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={lightbox.signedUrl}
                  download={lightbox.fileName}
                  className="rounded-md bg-white/90 px-3 py-1.5 text-sm font-medium text-icam-900 hover:bg-white"
                >
                  Descargar
                </a>
                <button
                  type="button"
                  className="rounded-md border border-white/40 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
                  onClick={() => setLightbox(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
