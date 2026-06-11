"use client";

import { useRef, useTransition } from "react";

import { uploadAttachment } from "@/modules/pm/actas/attachments/actions";
import { validateAttachmentFile } from "@/modules/pm/actas/attachments/types";

interface ActasAttachmentsButtonProps {
  elementId: string;
  count: number;
  onUploaded: () => void;
  onError?: (message: string) => void;
}

function PaperclipIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

export function ActasAttachmentsButton({
  elementId,
  count,
  onUploaded,
  onError,
}: ActasAttachmentsButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    for (const file of files) {
      const error = validateAttachmentFile({ type: file.type, size: file.size });
      if (error) {
        onError?.(error);
        return;
      }
    }
    startTransition(async () => {
      for (const file of files) {
        const fd = new FormData();
        fd.set("elementId", elementId);
        fd.set("file", file);
        const result = await uploadAttachment(fd);
        if (!result.ok) {
          onError?.(result.error);
          return;
        }
      }
      onUploaded();
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-muted hover:bg-icam-900/10 hover:text-icam-900 disabled:opacity-50"
        aria-label={count > 0 ? `Adjuntos (${count})` : "Adjuntar imagen"}
        title="Adjuntar imagen"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <PaperclipIcon />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-icam-900 px-0.5 text-[8px] font-bold text-white tabular-nums">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
        multiple
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}
