"use client";

import { useState } from "react";

import { fmtPorcentaje, hayCambioVsZoho } from "@/modules/pm/avance/logic/avance-obra";

interface AvanceFaseRowProps {
  faseId: string;
  nombre: string;
  /** Valor local del panel: puede diferir de lo guardado mientras no se pulsa «Guardar». */
  valor: number | null;
  porcentajeZoho: number | null;
  /** Hay una edición sin guardar en esta fase. */
  dirty: boolean;
  /** Barra más gruesa y tipografía mayor para el «Avance general». */
  destacado?: boolean;
  hasWriteAccess: boolean;
  onChange: (faseId: string, valor: number | null) => void;
}

function redondea2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Una fase de obra: barra deslizante para el ajuste rápido y, al lado, el
 * valor exacto que se puede teclear con decimales — los que trae Zoho no son
 * enteros (45,38 %, 26,54 %...) y arrastrar no llega a esa precisión.
 *
 * No guarda nada aquí: solo avisa al panel del cambio (`onChange`). Lo
 * persiste y lo sube a Zoho el botón «Guardar» de la pestaña, sobre todas las
 * fases tocadas a la vez — por eso el estado vive en el panel, no aquí.
 */
export function AvanceFaseRow({
  faseId,
  nombre,
  valor,
  porcentajeZoho,
  dirty,
  destacado = false,
  hasWriteAccess,
  onChange,
}: AvanceFaseRowProps) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");

  // Ya guardado pero sin comunicar a Zoho (fallo previo, o fase sin nombre de
  // campo). Si hay una edición local sin guardar, esa es la que manda.
  const pendienteEnvio = !dirty && hayCambioVsZoho(valor, porcentajeZoho);
  const completo = valor !== null && valor >= 100;

  const abrirEditor = () => {
    if (!hasWriteAccess) return;
    setBorrador(valor === null ? "" : String(valor));
    setEditando(true);
  };

  const commitDraft = (raw: string) => {
    setEditando(false);
    if (raw.trim() === "") {
      onChange(faseId, null);
      return;
    }
    const n = Number(raw.trim().replace(",", "."));
    if (!Number.isFinite(n)) return;
    onChange(faseId, redondea2(Math.max(0, Math.min(100, n))));
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
          {dirty ? (
            <span
              className="rounded border border-icam-900/30 bg-icam-900/[0.06] px-1 py-0.5 text-[10px] font-medium text-icam-900"
              title="Cambio sin guardar todavía."
            >
              sin guardar
            </span>
          ) : pendienteEnvio ? (
            <span
              className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700"
              title={`Zoho tiene ${fmtPorcentaje(porcentajeZoho)}. No se ha podido comunicar todavía.`}
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
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setBorrador(e.target.value)}
              onBlur={(e) => commitDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditando(false);
              }}
              placeholder="sin dato"
              aria-label={`Porcentaje exacto de ${nombre}`}
              className="w-24 rounded border border-icam-900/30 bg-page px-1.5 py-0.5 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-icam-900/20"
            />
          ) : (
            <button
              type="button"
              onClick={abrirEditor}
              disabled={!hasWriteAccess}
              title={hasWriteAccess ? "Teclear el valor exacto" : undefined}
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
              onClick={() => onChange(faseId, null)}
              title="Dejar sin dato (no es lo mismo que 0 %)"
              aria-label={`Dejar ${nombre} sin dato`}
              className="rounded px-1 text-xs text-text-muted hover:bg-page hover:text-text-primary"
            >
              ✕
            </button>
          ) : null}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={valor ?? 0}
        disabled={!hasWriteAccess}
        aria-label={`Arrastrar para fijar el porcentaje de ${nombre}`}
        onChange={(e) => onChange(faseId, Number(e.target.value))}
        className={`mt-1 w-full cursor-pointer disabled:cursor-default disabled:opacity-60 ${
          destacado ? "h-3" : "h-2"
        } ${completo ? "accent-emerald-600" : "accent-icam-900"}`}
        style={valor === null ? { opacity: 0.35 } : undefined}
      />
    </div>
  );
}
