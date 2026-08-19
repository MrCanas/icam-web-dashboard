"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateAvanceFase } from "@/modules/pm/avance/actions/update-avance-fase";
import {
  anchoBarra,
  fmtPorcentaje,
  hayCambioVsZoho,
  validatePorcentaje,
} from "@/modules/pm/avance/logic/avance-obra";

interface AvanceFaseRowProps {
  promocionId: string;
  faseId: string;
  nombre: string;
  porcentaje: number | null;
  porcentajeZoho: number | null;
  /** Barra más gruesa y tipografía mayor para el «Avance general». */
  destacado?: boolean;
  hasWriteAccess: boolean;
  onError: (message: string) => void;
}

/**
 * Una fase de obra: etiqueta, porcentaje y barra.
 *
 * El editor es un input numérico con 2 decimales, no un deslizador: los valores
 * de Zoho son 45,38 / 26,54 / 1,35 y un deslizador con paso entero los
 * destrozaría. Y el botón «vaciar» es necesario porque `null` («Zoho no tiene
 * valor») no se puede expresar con un número — dejarlo a 0 sería mentir.
 */
export function AvanceFaseRow({
  promocionId,
  faseId,
  nombre,
  porcentaje,
  porcentajeZoho,
  destacado = false,
  hasWriteAccess,
  onError,
}: AvanceFaseRowProps) {
  const router = useRouter();
  const [valor, setValor] = useState<number | null>(porcentaje);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [pending, startTransition] = useTransition();

  const pendienteZoho = hayCambioVsZoho(valor, porcentajeZoho);
  const completo = valor !== null && valor >= 100;

  const guardar = (raw: string) => {
    setEditando(false);
    const validado = validatePorcentaje(raw);
    if (!validado.ok) {
      onError(validado.error);
      return;
    }
    if (validado.value === valor) return;

    const previo = valor;
    setValor(validado.value); // optimista
    startTransition(async () => {
      const r = await updateAvanceFase({ promocionId, faseId, porcentaje: validado.value });
      if (!r.ok) {
        setValor(previo); // rollback
        onError(r.error);
        return;
      }
      router.refresh();
    });
  };

  const abrirEditor = () => {
    if (!hasWriteAccess || pending) return;
    setBorrador(valor === null ? "" : String(valor));
    setEditando(true);
  };

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`min-w-0 truncate ${
            destacado ? "text-sm font-semibold text-text-primary" : "text-sm text-text-body"
          } ${valor === null ? "text-text-muted" : ""}`}
        >
          {nombre}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {pendienteZoho ? (
            <span
              className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700"
              title={`Zoho tiene ${fmtPorcentaje(porcentajeZoho)}. Pendiente de aprobación para comunicarlo.`}
            >
              pendiente
            </span>
          ) : null}

          {editando ? (
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              autoFocus
              value={borrador}
              disabled={pending}
              onChange={(e) => setBorrador(e.target.value)}
              onBlur={(e) => guardar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditando(false);
              }}
              placeholder="sin dato"
              aria-label={`Porcentaje de ${nombre}`}
              className="w-24 rounded border border-icam-900/30 bg-page px-1.5 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-icam-900/20"
            />
          ) : (
            <button
              type="button"
              onClick={abrirEditor}
              disabled={!hasWriteAccess || pending}
              title={hasWriteAccess ? "Editar" : undefined}
              className={`rounded px-1 tabular-nums ${
                destacado ? "text-base font-semibold" : "text-sm"
              } ${completo ? "font-semibold text-emerald-600" : "text-text-muted"} ${
                hasWriteAccess
                  ? "cursor-pointer hover:bg-page hover:text-text-primary disabled:opacity-60"
                  : "cursor-default"
              }`}
            >
              {fmtPorcentaje(valor)}
            </button>
          )}

          {hasWriteAccess && valor !== null ? (
            <button
              type="button"
              onClick={() => guardar("")}
              disabled={pending}
              title="Dejar sin dato (no es lo mismo que 0 %)"
              aria-label={`Dejar ${nombre} sin dato`}
              className="rounded px-1 text-xs text-text-muted hover:bg-page hover:text-text-primary disabled:opacity-60"
            >
              ✕
            </button>
          ) : null}
        </span>
      </div>

      <div
        className={`mt-1 overflow-hidden rounded-full bg-subtle ${destacado ? "h-3" : "h-2"}`}
      >
        <div
          className={`h-full rounded-full transition-all ${
            completo ? "bg-emerald-600" : "bg-icam-900"
          }`}
          style={{ width: anchoBarra(valor) }}
        />
      </div>
    </div>
  );
}
