"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { guardarAjustesAction } from "@/modules/comunicaciones/actions/envio";
import { LIMITE_DIARIO_ZOHO, type ComAjustesRow, type ModoEnvio } from "@/modules/comunicaciones/types";

interface Props {
  ajustes: ComAjustesRow;
  /** Las cuentas de prueba que el candado deja usar. */
  cuentasDePrueba: { zohoId: string; nombre: string }[];
}

const CAMPO = "block w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-text-body";
const LEYENDA = "text-sm font-semibold text-text-primary";

/**
 * Los interruptores del envío. Solo los ve editables un administrador de la
 * zona, y la acción vuelve a comprobarlo.
 */
export function AjustesForm({ ajustes, cuentasDePrueba }: Props) {
  const router = useRouter();
  const [enviosActivados, setEnviosActivados] = useState(ajustes.envios_activados);
  const [modo, setModo] = useState<ModoEnvio>(ajustes.modo);
  const [cuentaPruebas, setCuentaPruebas] = useState(ajustes.cuenta_pruebas_zoho_id ?? "");
  const [remitentes, setRemitentes] = useState(ajustes.remitentes_permitidos.join("\n"));
  const [limiteDiario, setLimiteDiario] = useState(String(ajustes.limite_diario ?? LIMITE_DIARIO_ZOHO));
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, empezar] = useTransition();

  const guardar = () =>
    empezar(async () => {
      setMensaje(null);
      const r = await guardarAjustesAction({
        enviosActivados,
        modo,
        cuentaPruebasZohoId: cuentaPruebas || null,
        remitentesPermitidos: remitentes.split(/[\s,;]+/).filter(Boolean),
        limiteDiario: Number(limiteDiario),
      });
      if (r.ok) {
        setMensaje({ ok: true, texto: "Ajustes guardados." });
        router.refresh();
      } else {
        setMensaje({ ok: false, texto: r.mensaje });
      }
    });

  return (
    <form
      className="space-y-4 rounded-lg border border-subtle/50 bg-card p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <fieldset className="space-y-1">
        <legend className={LEYENDA}>Interruptor general</legend>
        <label className="flex items-start gap-2 text-sm text-text-body">
          <input
            type="checkbox"
            checked={enviosActivados}
            onChange={(e) => setEnviosActivados(e.target.checked)}
            className="mt-1"
          />
          <span>
            Envíos activados. Apagado, no sale ningún correo, ni de prueba, y un envío en curso se para antes
            del siguiente correo.
          </span>
        </label>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className={LEYENDA}>Modo</legend>
        <label className="flex items-start gap-2 text-sm text-text-body">
          <input type="radio" name="modo" checked={modo === "pruebas"} onChange={() => setModo("pruebas")} className="mt-1" />
          <span>Pruebas: todo correo se redirige a quien lo envía, sea cual sea la lista.</span>
        </label>
        <label className="flex items-start gap-2 text-sm text-text-body">
          <input type="radio" name="modo" checked={modo === "real"} onChange={() => setModo("real")} className="mt-1" />
          <span>
            Real: los correos van a las direcciones de la lista. El candado de destinatarios sigue mandando.
          </span>
        </label>
      </fieldset>

      <label className="block space-y-1">
        <span className={LEYENDA}>Cuenta de pruebas</span>
        <span className="block text-sm text-text-muted">
          La prueba obligatoria se envía sobre esta cuenta, para no dejar correos de prueba en la ficha de un
          inversor.
        </span>
        <select value={cuentaPruebas} onChange={(e) => setCuentaPruebas(e.target.value)} className={CAMPO}>
          <option value="">(ninguna)</option>
          {cuentasDePrueba.map((c) => (
            <option key={c.zohoId} value={c.zohoId}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className={LEYENDA}>Remitentes permitidos</span>
        <span className="block text-sm text-text-muted">
          Una dirección por línea. Zoho solo acepta las que tenga configuradas el usuario dueño del token de
          envíos.
        </span>
        <textarea
          value={remitentes}
          onChange={(e) => setRemitentes(e.target.value)}
          rows={3}
          className={CAMPO}
          spellCheck={false}
        />
      </label>

      <label className="block space-y-1">
        <span className={LEYENDA}>Tope diario de correos</span>
        <span className="block text-sm text-text-muted">
          Zoho no deja enviar más de {LIMITE_DIARIO_ZOHO} correos al día por usuario. Un envío que no quepa en lo
          que queda del día no se puede confirmar. Cuentan también las pruebas.
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={LIMITE_DIARIO_ZOHO}
          value={limiteDiario}
          onChange={(e) => setLimiteDiario(e.target.value)}
          className={`${CAMPO} max-w-40`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={guardando}
          className="min-h-9 rounded-md bg-icam-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar ajustes"}
        </button>
        {mensaje ? (
          <span role={mensaje.ok ? "status" : "alert"} className={`text-sm ${mensaje.ok ? "text-text-body" : "text-[#9B3B3B]"}`}>
            {mensaje.texto}
          </span>
        ) : null}
      </div>
    </form>
  );
}
