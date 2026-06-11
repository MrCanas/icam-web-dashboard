/** Adjuntos (imágenes) de Actas — tipos y validación compartida cliente/servidor. */

export const ACTAS_ATTACHMENT_BUCKET = "actas-attachments";
export const ACTAS_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const ACTAS_ATTACHMENT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export type ActasAttachmentMime = (typeof ACTAS_ATTACHMENT_ALLOWED_MIME)[number];

export interface ActasAttachmentItem {
  id: string;
  elementId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
  uploadedBy: string;
  /** URL firmada temporal para mostrar/descargar (bucket privado). */
  signedUrl: string | null;
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function extForMime(mime: string): string {
  return MIME_EXT[mime] ?? "bin";
}

/**
 * Valida tipo y tamaño. Devuelve un mensaje de error en español o null si es
 * válido. Se usa en cliente (antes de subir) y en servidor (defensa).
 */
export function validateAttachmentFile(file: {
  type: string;
  size: number;
}): string | null {
  if (
    !ACTAS_ATTACHMENT_ALLOWED_MIME.includes(file.type as ActasAttachmentMime)
  ) {
    return "Formato no permitido. Solo imágenes JPG, PNG, WEBP, GIF o HEIC.";
  }
  if (file.size > ACTAS_ATTACHMENT_MAX_BYTES) {
    return "La imagen supera el máximo de 10 MB.";
  }
  if (file.size === 0) {
    return "El archivo está vacío.";
  }
  return null;
}
