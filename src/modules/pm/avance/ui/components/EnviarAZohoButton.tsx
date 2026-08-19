"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { enviarAZoho } from "@/modules/pm/avance/actions/enviar-a-zoho";

interface EnviarAZohoButtonProps {
  /** Cuántos cambios aprobados hay a la espera. */
  pendientes: number;
  isAdmin: boolean;
  /** Variables de entorno que faltan; vacío = conexión configurada. */
  faltanVariables: string[];
}

/**
 * El botón que sube a Zoho los cambios aprobados.
 *
 * Pide confirmación porque escribe en el CRM y eso no se deshace desde aquí.
 * Se usa un panel en línea, no `window.confirm`: un diálogo nativo bloquea la
 * pestaña y, además, permite explicar exactamente qué va a viajar.
 */
export function EnviarAZohoButton({
  pendientes,
  isAdmin,
  faltanVariables,
}: EnviarAZohoButtonProps) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const sinConexion = faltanVariables.length > 0;

  const enviar = () => {
    setConfirmando(false);
    startTransition(async () => {
      const r = await enviarAZoho();
      setMensaje(
        r.ok
          ? {
              tipo: "ok",
              texto: `${r.enviados} cambio${r.enviados === 1 ? "" : "s"} subido${
                r.enviados === 1 ? "" : "s"
              } a Zoho en ${r.promociones} promoción${r.promociones === 1 ? "" : "es"}.`,
            }
          : { tipo: "error", texto: r.error },
      );
      router.refresh();
    });
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || pendientes === 0 || sinConexion}
          onClick={() => setConfirmando(true)}
          title={
            sinConexion
              ? `La conexión con Zoho no está configurada (faltan ${faltanVariables.join(", ")})`
              : pendientes === 0
                ? "No hay cambios aprobados que subir"
                : "Escribe en Zoho CRM los cambios aprobados"
          }
          className="rounded border border-icam-900 bg-icam-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Subiendo…" : `Subir a Zoho${pendientes > 0 ? ` (${pendientes})` : ""}`}
        </button>

        {sinConexion ? (
          <span className="text-xs text-text-muted">
            Conexión sin configurar: de momento, descarga el CSV y súbelo desde Zoho.
          </span>
        ) : null}
      </div>

      {confirmando ? (
        <div className="rounded-lg border border-icam-900/30 bg-icam-900/[0.04] p-3">
          <p className="text-sm font-medium text-text-primary">
            Se van a escribir {pendientes} cambio{pendientes === 1 ? "" : "s"} en Zoho CRM.
          </p>
          <p className="mt-1 text-xs leading-snug text-text-muted">
            Solo viajan las fases aprobadas; el resto de campos de Zoho no se tocan. Esto
            sobrescribe el valor que Zoho tiene hoy y no se deshace desde aquí.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={enviar}
              className="rounded border border-icam-900 bg-icam-900 px-3 py-1 text-xs font-medium text-white hover:bg-icam-800 disabled:opacity-60"
            >
              Sí, subir a Zoho
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded border border-subtle px-3 py-1 text-xs text-text-body hover:bg-page"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {mensaje ? (
        <div
          role="alert"
          className={`flex items-start justify-between gap-3 rounded border p-2 text-xs ${
            mensaje.tipo === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <span>{mensaje.texto}</span>
          <button type="button" onClick={() => setMensaje(null)} className="shrink-0 font-medium">
            Cerrar
          </button>
        </div>
      ) : null}
    </div>
  );
}
