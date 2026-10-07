"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { Tarjeta } from "@/components/ui/Tarjeta";
import { guardarAjustesAction } from "@/modules/comunicaciones/actions/envio";
import { LIMITE_DIARIO_ZOHO, type ComAjustesRow, type ModoEnvio } from "@/modules/comunicaciones/types";

interface Props {
  ajustes: ComAjustesRow;
  /** Las cuentas de prueba que el candado deja usar. */
  cuentasDePrueba: { zohoId: string; nombre: string }[];
}

/** Una fila del formulario: etiqueta y ayuda a la izquierda, control a la derecha. */
function Fila({ etiqueta, ayuda, children }: { etiqueta: string; ayuda: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-subtle/60 py-4 first:border-t-0 first:pt-0 sm:grid-cols-[14rem_1fr] sm:gap-x-6">
      <div className="flex items-start gap-1.5">
        <span className="text-sm font-medium text-text-primary">{etiqueta}</span>
        <Ayuda>{ayuda}</Ayuda>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

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

  const opcionDeModo = (valor: ModoEnvio, etiqueta: string, descripcion: string, peligro?: boolean) => {
    const activo = modo === valor;
    return (
      <label
        className={`flex flex-1 cursor-pointer items-start gap-2 rounded-md border p-3 text-sm transition ${
          activo
            ? peligro
              ? "border-red-300 bg-red-50"
              : "border-icam-900 bg-icam-900/[0.04]"
            : "border-subtle hover:border-icam-900/40"
        }`}
      >
        <input type="radio" name="modo" checked={activo} onChange={() => setModo(valor)} className="mt-0.5 accent-icam-900" />
        <span>
          <span className={`block font-medium ${activo && peligro ? "text-red-800" : "text-text-primary"}`}>{etiqueta}</span>
          <span className="block text-xs text-text-muted">{descripcion}</span>
        </span>
      </label>
    );
  };

  return (
    <Tarjeta className="max-w-3xl" titulo="Ajustes de envío" subtitulo="Solo los cambia un administrador de la zona. Cada cambio queda en el registro.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Fila
          etiqueta="Interruptor general"
          ayuda="Apagado, no sale ningún correo, ni de prueba, y un envío en curso se para antes del siguiente correo. Se consulta antes de cada correo."
        >
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-body">
            <input type="checkbox" checked={enviosActivados} onChange={(e) => setEnviosActivados(e.target.checked)} className="accent-icam-900" />
            Envíos activados
            {enviosActivados ? <Chip tono="ok">encendido</Chip> : <Chip tono="error">apagado</Chip>}
          </label>
        </Fila>

        <Fila
          etiqueta="Modo"
          ayuda="En pruebas, todo correo se redirige a quien lo envía, sea cual sea la lista. En real, van a las direcciones de la lista; el candado de destinatarios sigue mandando."
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            {opcionDeModo("pruebas", "Pruebas", "Todo correo se redirige a quien lo envía.")}
            {opcionDeModo("real", "Real", "Los correos van a las direcciones de la lista.", true)}
          </div>
        </Fila>

        <Fila
          etiqueta="Cuenta de pruebas"
          ayuda="La prueba obligatoria se envía sobre esta cuenta, para no dejar correos de prueba en la ficha de un inversor. Tiene que ser una cuenta de prueba de la promoción de pruebas."
        >
          <select value={cuentaPruebas} onChange={(e) => setCuentaPruebas(e.target.value)} className={claseCampo}>
            <option value="">(ninguna)</option>
            {cuentasDePrueba.map((c) => (
              <option key={c.zohoId} value={c.zohoId}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Fila>

        <Fila
          etiqueta="Remitentes permitidos"
          ayuda="Una dirección por línea. Zoho solo acepta las que tenga configuradas el usuario dueño del token de envíos; se comprueba antes de cada envío."
        >
          <textarea value={remitentes} onChange={(e) => setRemitentes(e.target.value)} rows={3} className={`${claseCampo} font-mono text-xs`} spellCheck={false} />
        </Fila>

        <Fila
          etiqueta="Tope diario de correos"
          ayuda={`Zoho no deja enviar más de ${LIMITE_DIARIO_ZOHO} correos al día por usuario. Un envío que no quepa en lo que queda del día no se puede confirmar, y una tanda no pasa del tope. Cuentan también las pruebas.`}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={LIMITE_DIARIO_ZOHO}
            value={limiteDiario}
            onChange={(e) => setLimiteDiario(e.target.value)}
            className={`${claseCampo} max-w-40`}
          />
        </Fila>

        <div className="flex flex-wrap items-center gap-3 border-t border-subtle/60 pt-4">
          <Boton type="submit" variante="primario" cargando={guardando}>
            Guardar ajustes
          </Boton>
          {mensaje ? (
            <Aviso tipo={mensaje.ok ? "ok" : "error"} className="flex-1">
              {mensaje.texto}
            </Aviso>
          ) : null}
        </div>
      </form>
    </Tarjeta>
  );
}
