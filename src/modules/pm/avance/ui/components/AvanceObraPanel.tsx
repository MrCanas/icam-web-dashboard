"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { guardarAvanceZoho } from "@/modules/pm/avance/actions/guardar-avance-zoho";
import { AVANCE_OBRA_HUB_PATH } from "@/modules/pm/avance/logic/avance-paths";
import {
  fmtPorcentaje,
  generalDivergeDeFases,
} from "@/modules/pm/avance/logic/avance-obra";
import type { PmAvanceProyecto } from "@/modules/pm/avance/types";
import { AvanceFaseRow } from "./AvanceFaseRow";

interface AvanceObraPanelProps {
  data: PmAvanceProyecto;
  hasWriteAccess: boolean;
}

type Valores = Record<string, number | null>;

function valoresDe(data: PmAvanceProyecto): Valores {
  const m: Valores = {};
  if (data.general) m[data.general.fase.id] = data.general.porcentaje;
  for (const f of data.fases) m[f.fase.id] = f.porcentaje;
  return m;
}

/**
 * El cuerpo de la pestaña. Es cliente porque las fases se editan con un
 * slider y el «Guardar» junta todo lo tocado en un único envío.
 *
 * El valor de cada fase vive aquí, no en `AvanceFaseRow`: arrastrar el slider
 * solo actualiza este estado local, y hasta que no se pulsa «Guardar» no se
 * persiste nada ni viaja nada a Zoho. Eso sustituye, para lo que se edita
 * desde este panel, el paso de aprobación de la bandeja de salida — «Guardar»
 * hace las dos cosas de un golpe (ver `guardarAvanceZoho`).
 */
export function AvanceObraPanel({ data, hasWriteAccess }: AvanceObraPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { promocion, general, fases, pendientes } = data;

  const original = useMemo(() => valoresDe(data), [data]);
  const [valores, setValores] = useState<Valores>(original);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  // Tras guardar, `data` llega refrescada del servidor: resincroniza el
  // estado local con lo que ya quedó persistido. Se ajusta durante el render
  // (no en un efecto) siguiendo el patrón que React recomienda para "resetear
  // estado cuando cambia una prop": React repite el render antes de pintar,
  // así que no hay parpadeo con el valor viejo.
  const [dataParaValores, setDataParaValores] = useState(data);
  if (dataParaValores !== data) {
    setDataParaValores(data);
    setValores(original);
  }

  const cambios = useMemo(
    () =>
      Object.entries(valores).filter(
        ([faseId, v]) => v !== (Object.prototype.hasOwnProperty.call(original, faseId) ? original[faseId] : null),
      ),
    [valores, original],
  );
  const faseIdsSinGuardar = useMemo(() => new Set(cambios.map(([id]) => id)), [cambios]);
  const hayCambios = cambios.length > 0;

  const cambiar = (faseId: string, valor: number | null) => {
    setAviso(null);
    setValores((prev) => ({ ...prev, [faseId]: valor }));
  };

  const descartarCambios = () => {
    setConfirmando(false);
    setValores(original);
  };

  const guardar = () => {
    setConfirmando(false);
    startTransition(async () => {
      const r = await guardarAvanceZoho({
        promocionId: promocion.id,
        cambios: cambios.map(([faseId, porcentaje]) => ({ faseId, porcentaje })),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      const partes: string[] = [];
      if (r.enviados > 0) {
        partes.push(
          `${r.enviados} fase${r.enviados === 1 ? "" : "s"} guardada${r.enviados === 1 ? "" : "s"} y enviada${r.enviados === 1 ? "" : "s"} a Zoho.`,
        );
      }
      if (r.pendientes.length > 0) {
        partes.push(
          `${r.pendientes.length} sin nombre de campo en Zoho (${r.pendientes.join(", ")}): guardada${r.pendientes.length === 1 ? "" : "s"}, pendiente${r.pendientes.length === 1 ? "" : "s"} en la bandeja de salida.`,
        );
      }
      setAviso(partes.length > 0 ? partes.join(" ") : "No había nada nuevo que enviar a Zoho.");
      router.refresh();
    });
  };

  const divergencia = generalDivergeDeFases(
    valores[general?.fase.id ?? ""] ?? null,
    fases.map((f) => valores[f.fase.id] ?? null),
  );
  const pendientesSinAprobar = pendientes.filter((p) => p.estado === "pendiente");

  return (
    <div className="space-y-4 min-w-0">
      {error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 font-medium">
            Cerrar
          </button>
        </div>
      ) : null}

      {aviso ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <span>{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="shrink-0 font-medium">
            Cerrar
          </button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-subtle/50 bg-card shadow-sm">
        <div className="h-[3px] bg-icam-gold" />
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Promoción en Zoho
            </h2>
            <span className="text-sm font-semibold text-text-primary">
              {promocion.codigo_promocion}
            </span>
            {promocion.nombre ? (
              <span className="text-sm text-text-muted">{promocion.nombre}</span>
            ) : null}
            {promocion.tipo_proyecto ? (
              <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-text-muted">
                {promocion.tipo_proyecto}
              </span>
            ) : null}
            {promocion.situacion ? (
              <span className="rounded-full bg-subtle px-2 py-0.5 text-xs text-text-muted">
                {promocion.situacion}
              </span>
            ) : null}
          </div>

          {promocion.direccion && promocion.direccion !== promocion.nombre ? (
            <p className="-mt-2 text-xs text-text-muted">{promocion.direccion}</p>
          ) : null}

          {general ? (
            <AvanceFaseRow
              faseId={general.fase.id}
              nombre={general.fase.nombre}
              valor={valores[general.fase.id] ?? null}
              porcentajeZoho={general.porcentajeZoho}
              dirty={faseIdsSinGuardar.has(general.fase.id)}
              destacado
              hasWriteAccess={hasWriteAccess && !pending}
              onChange={cambiar}
            />
          ) : null}

          <p className="rounded border border-subtle/60 bg-page px-2 py-1.5 text-xs leading-snug text-text-muted">
            «Avance general» es el valor que reporta Zoho, no la media de las fases: aquí no se
            recalcula nada.
            {divergencia.diverge ? (
              <>
                {" "}
                En esta promoción no cuadran —las fases con dato promedian{" "}
                <span className="font-medium text-text-body">
                  {fmtPorcentaje(divergencia.mediaFases)}
                </span>
                —, y es lo esperable: Zoho pondera cada fase a su manera.
              </>
            ) : null}
          </p>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-subtle/50 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-icam-900">Fases de obra</h2>
          {hasWriteAccess ? (
            <div className="flex items-center gap-2">
              {hayCambios ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={descartarCambios}
                  className="rounded border border-subtle px-3 py-1.5 text-xs text-text-body hover:bg-page disabled:opacity-50"
                >
                  Descartar cambios
                </button>
              ) : null}
              <button
                type="button"
                disabled={!hayCambios || pending}
                onClick={() => setConfirmando(true)}
                title={
                  hayCambios
                    ? "Guarda y sube a Zoho las fases tocadas"
                    : "No hay cambios sin guardar"
                }
                className="rounded border border-icam-900 bg-icam-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-icam-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          ) : null}
        </div>

        {confirmando ? (
          <div className="rounded-lg border border-icam-900/30 bg-icam-900/[0.04] p-3">
            <p className="text-sm font-medium text-text-primary">
              Se van a guardar {cambios.length} fase{cambios.length === 1 ? "" : "s"} y subirlas a
              Zoho.
            </p>
            <p className="mt-1 text-xs leading-snug text-text-muted">
              Esto sobrescribe el valor que Zoho tiene hoy y no se deshace desde aquí.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={guardar}
                className="rounded border border-icam-900 bg-icam-900 px-3 py-1 text-xs font-medium text-white hover:bg-icam-800"
              >
                Sí, guardar y enviar
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

        {fases.length === 0 ? (
          <p className="text-sm text-text-muted">El catálogo de fases está vacío.</p>
        ) : (
          <div className="space-y-3">
            {fases.map((f) => (
              <AvanceFaseRow
                key={f.fase.id}
                faseId={f.fase.id}
                nombre={f.fase.nombre}
                valor={valores[f.fase.id] ?? null}
                porcentajeZoho={f.porcentajeZoho}
                dirty={faseIdsSinGuardar.has(f.fase.id)}
                hasWriteAccess={hasWriteAccess && !pending}
                onChange={cambiar}
              />
            ))}
          </div>
        )}
        <p className="text-xs leading-snug text-text-muted">
          «—» es <span className="font-medium">sin dato en Zoho</span>, que no es lo mismo que
          0 %. {hasWriteAccess ? "El aspa vacía el dato; arrastra o teclea para cambiarlo, y «Guardar» lo sube a Zoho." : null}
        </p>
      </section>

      {pendientesSinAprobar.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <h2 className="text-sm font-semibold text-amber-800">
            {pendientesSinAprobar.length} cambio
            {pendientesSinAprobar.length === 1 ? "" : "s"} sin comunicar a Zoho
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {pendientesSinAprobar.map((p) => (
              <li key={p.id}>
                {p.fase_nombre}: {fmtPorcentaje(p.porcentaje_zoho)} →{" "}
                <span className="font-medium">{fmtPorcentaje(p.porcentaje_nuevo)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-snug text-amber-800">
            Sin nombre de campo en Zoho para estas fases, no se pueden enviar por API. Un
            administrador de PM puede exportarlas a mano desde{" "}
            <Link href={AVANCE_OBRA_HUB_PATH} className="font-medium underline">
              Avance de obra · bandeja de salida
            </Link>
            .
          </p>
        </section>
      ) : null}
    </div>
  );
}
