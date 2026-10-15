"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Boton, BotonEnlace } from "@/components/ui/Boton";
import { claseCampo } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { Icono } from "@/components/ui/Icono";
import { Stepper } from "@/components/ui/Stepper";
import { fmtFechaHora, fmtInt } from "@/lib/formatters";
import {
  actualizarDatosZohoAction,
  prepararComunicacionAction,
} from "@/modules/comunicaciones/actions/comunicaciones";
import { ETIQUETA_PASO, PASOS } from "@/modules/comunicaciones/logic/asistente";
import { COMUNICACIONES_PATH } from "@/modules/comunicaciones/logic/paths";
import {
  AUDIENCIAS,
  ETIQUETA_AUDIENCIA,
  ETIQUETA_ROL,
  ETIQUETA_TIPO,
  ROLES_CONTACTO,
  TIPOS_COMUNICACION,
  type AudienciaElegible as Audiencia,
  type RecuentoAudiencias,
  type RolContacto,
  type TipoComunicacion,
} from "@/modules/comunicaciones/types";

import { ChipEntorno } from "./ChipEntorno";
import type { EntornoDeEnvio } from "./entorno";
import { ListaGuiada, PreguntaGuiada, type EstadoPregunta } from "./guiado";
import { BarraDeAcciones, ModoFoco, PasoDelAsistente } from "./marco";

const DESCRIPCION_AUDIENCIA: Record<Audiencia, string> = {
  promocion: "Los inversores de una promoción o un fondo concreto.",
  toda_la_base: "Todas las cuentas de inversión, sin filtrar.",
  inversores_directos: "Las cuentas que no llegan a través de un intermediario.",
};

const DESCRIPCION_TIPO: Record<TipoComunicacion, string> = {
  reporte: "Informe periódico o de avance",
  evento: "Invitación o aviso de un evento",
  newsletter: "Novedades generales",
  oportunidad: "Una nueva inversión",
  otro: "Cualquier otra cosa",
};

const DESCRIPCION_ROL: Record<RolContacto, string> = {
  principal: "La persona de referencia de la cuenta",
  secundario: "El segundo contacto de la cuenta",
  representante_legal: "Quien firma en nombre de la cuenta",
  abogado: "El asesor legal de la cuenta",
  intermediario: "Quien trajo la inversión",
};

type Destino = "para" | "copia";

type Pregunta = "zoho" | "audiencia" | "promocion" | "tipo" | "contactos";

/**
 * Paso 1 de una comunicación nueva, como una conversación: una pregunta cada
 * vez. Cada respuesta se pliega en una línea («Cambiar» la reabre) y abre la
 * siguiente. «Continuar» calcula los destinatarios y guarda el borrador; no
 * envía nada. El servidor lo vuelve a comprobar todo, también que los datos de
 * Zoho sean de hoy.
 */
export function NuevaComunicacion({
  recuento,
  datosZohoAt,
  datosDeHoy,
  entorno,
}: {
  recuento: RecuentoAudiencias;
  datosZohoAt: string | null;
  /** Lo decide el servidor, con la fecha de Madrid: es el mismo corte que aplica al preparar. */
  datosDeHoy: boolean;
  entorno: EntornoDeEnvio;
}) {
  const router = useRouter();
  const [audiencia, setAudiencia] = useState<Audiencia | "">("");
  const [promociones, setPromociones] = useState<string[]>([]);
  const [promocionesListas, setPromocionesListas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoComunicacion | "">("");
  // Qué papeles reciben el correo y cómo: en «Para» o en copia.
  const [papeles, setPapeles] = useState<Partial<Record<RolContacto, Destino>>>({ principal: "para" });
  const [contactosListos, setContactosListos] = useState(false);
  const [editando, setEditando] = useState<Pregunta | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [preparando, empezarPreparar] = useTransition();
  const [actualizando, empezarActualizar] = useTransition();

  const promocionesElegidas = recuento.promociones.filter((p) => promociones.includes(p.zohoId));
  // Una cuenta en dos promociones cuenta una vez.
  const cuentasDePromociones = new Set(promocionesElegidas.flatMap((p) => p.cuentaIds)).size;
  const cuentas =
    audiencia === "toda_la_base"
      ? recuento.todaLaBase
      : audiencia === "inversores_directos"
        ? recuento.inversoresDirectos
        : audiencia === "promocion"
          ? cuentasDePromociones
          : null;
  const rolesPara = ROLES_CONTACTO.filter((r) => papeles[r] === "para");
  const rolesCopia = ROLES_CONTACTO.filter((r) => papeles[r] === "copia");

  // Las preguntas, en orden, y si cada una está respondida.
  const preguntas: { clave: Pregunta; respondida: boolean }[] = [
    ...(datosDeHoy ? [] : [{ clave: "zoho" as const, respondida: false }]),
    { clave: "audiencia", respondida: audiencia !== "" },
    ...(audiencia === "promocion" ? [{ clave: "promocion" as const, respondida: promocionesListas && promociones.length > 0 }] : []),
    { clave: "tipo", respondida: tipo !== "" },
    { clave: "contactos", respondida: contactosListos && rolesPara.length > 0 },
  ];
  const primeraSinResponder = preguntas.find((p) => !p.respondida)?.clave ?? null;
  const activa: Pregunta | null = editando ?? primeraSinResponder;
  const indiceActiva = activa ? preguntas.findIndex((p) => p.clave === activa) : preguntas.length;
  const estadoDe = (clave: Pregunta): EstadoPregunta => {
    const i = preguntas.findIndex((p) => p.clave === clave);
    if (clave === activa) return "activa";
    if (preguntas[i].respondida) return "hecha";
    return i < indiceActiva ? "hecha" : "bloqueada";
  };
  const numeroDe = (clave: Pregunta) => preguntas.findIndex((p) => p.clave === clave) + 1;
  const respondidas = preguntas.filter((p) => p.respondida).length;
  const todoListo = primeraSinResponder === null;

  /** Responder una pregunta la cierra: se sigue con la primera que falte. */
  const responder = () => setEditando(null);

  const promocionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return recuento.promociones;
    return recuento.promociones.filter((p) => p.nombre.toLowerCase().includes(q) || (p.codigo ?? "").toLowerCase().includes(q));
  }, [busqueda, recuento.promociones]);

  const textoContactos = `${rolesPara.map((r) => ETIQUETA_ROL[r]).join(", ") || "nadie"} en Para${
    rolesCopia.length > 0 ? ` · ${rolesCopia.map((r) => ETIQUETA_ROL[r]).join(", ")} en copia` : ""
  }`;
  const textoPromociones =
    promocionesElegidas.length === 1
      ? promocionesElegidas[0].nombre
      : `${promocionesElegidas.length} promociones o fondos`;

  /** Marca o desmarca una promoción. Cambiarlas obliga a confirmar otra vez. */
  const alternarPromocion = (id: string) => {
    setPromociones((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
    setPromocionesListas(false);
  };

  /** Marca o desmarca un papel; al marcarlo entra en «Para». */
  const alternarPapel = (rol: RolContacto) => {
    setPapeles((p) => {
      const nuevo = { ...p };
      if (nuevo[rol]) delete nuevo[rol];
      else nuevo[rol] = "para";
      return nuevo;
    });
    setContactosListos(false);
  };

  const preparar = () => {
    if (!todoListo) return;
    setAviso(null);
    empezarPreparar(async () => {
      try {
        const r = await prepararComunicacionAction({
          tipo: tipo as TipoComunicacion,
          audiencia: audiencia as Audiencia,
          promocionesZohoIds: promociones,
          rolesPara,
          rolesCopia,
        });
        if (r.ok) router.push(`${r.path}?paso=destinatarios`);
        else setAviso({ ok: false, mensaje: r.mensaje });
      } catch (err) {
        setAviso({ ok: false, mensaje: err instanceof Error ? err.message : "No se pudo preparar la comunicación." });
      }
    });
  };

  const actualizar = () =>
    empezarActualizar(async () => {
      setAviso(null);
      const r = await actualizarDatosZohoAction();
      setAviso({ ok: r.ok, mensaje: r.mensaje });
      if (r.ok) router.refresh();
    });

  const queFalta: Record<Pregunta, string> = {
    zoho: "Primero, actualiza los datos de Zoho",
    audiencia: "Elige la audiencia",
    promocion: "Elige las promociones o fondos",
    tipo: "Elige el tipo de comunicación",
    contactos: "Elige quién de cada cuenta lo recibe",
  };

  return (
    <ModoFoco
      titulo="Nueva comunicación"
      subtitulo="Sin guardar todavía"
      entorno={<ChipEntorno entorno={entorno} />}
      stepper={
        <Stepper
          variante="linea"
          etiqueta="Pasos del envío"
          pasos={PASOS.map((p) => ({ clave: p, etiqueta: ETIQUETA_PASO[p], estado: p === "audiencia" ? "actual" : "pendiente" }))}
        />
      }
    >
      <PasoDelAsistente
        ancho="estrecho"
        titulo="¿A quién va dirigida?"
        subtitulo={`${preguntas.length} preguntas rápidas. En el siguiente paso verás la lista exacta de destinatarios; todavía no sale nada.`}
        pie={
          <BarraDeAcciones
            atras={
              <BotonEnlace href={COMUNICACIONES_PATH} variante="texto">
                Cancelar
              </BotonEnlace>
            }
            motivo={
              todoListo ? (
                <span className="text-green-700">Todo listo · se calcularán los destinatarios de {fmtInt(cuentas ?? 0)} cuentas</span>
              ) : (
                <>
                  <span className="font-medium text-text-primary">
                    {respondidas} de {preguntas.length}
                  </span>{" "}
                  · {queFalta[primeraSinResponder!]}
                </>
              )
            }
            principal={
              <Boton variante="primario" cargando={preparando} disabled={!todoListo || actualizando} onClick={preparar}>
                {preparando ? "Calculando destinatarios…" : "Continuar a Destinatarios"}
                {preparando ? null : <Icono nombre="chevron" className="h-3.5 w-3.5" />}
              </Boton>
            }
          />
        }
      >
        <ListaGuiada>
          {!datosDeHoy ? (
            <PreguntaGuiada
              numero={numeroDe("zoho")}
              estado={estadoDe("zoho")}
              titulo="Actualiza los datos de Zoho"
              subtitulo={`${datosZohoAt ? `La última copia es del ${fmtFechaHora(datosZohoAt)}.` : "Todavía no hay ninguna copia correcta."} Los destinatarios se calculan con la de hoy.`}
              ayuda="La copia de Zoho del portal se actualiza cada día de madrugada. Actualizarla solo lee de Zoho. Si la actualización queda «parcial», la fecha no cambia: vuelve a intentarlo o avisa."
              cargando={actualizando}
            >
              <Boton variante="primario" cargando={actualizando} icono={<Icono nombre="actualizar" />} onClick={actualizar}>
                {actualizando ? "Actualizando… (alrededor de un minuto)" : "Actualizar ahora"}
              </Boton>
            </PreguntaGuiada>
          ) : null}

          <PreguntaGuiada
            numero={numeroDe("audiencia")}
            estado={estadoDe("audiencia")}
            titulo="¿A quién quieres escribir?"
            subtitulo="Elige el grupo de inversores."
            respuesta={audiencia ? ETIQUETA_AUDIENCIA[audiencia] : null}
            onCambiar={() => setEditando("audiencia")}
          >
            <div className="grid gap-2">
              {AUDIENCIAS.map((a) => {
                const n = a === "toda_la_base" ? recuento.todaLaBase : a === "inversores_directos" ? recuento.inversoresDirectos : recuento.promociones.length;
                const elegida = audiencia === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAudiencia(a);
                      if (a !== "promocion") {
                        setPromociones([]);
                        setPromocionesListas(false);
                      }
                      // Si elige promoción, la siguiente pregunta es cuál.
                      setEditando(a === "promocion" ? "promocion" : null);
                    }}
                    className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 ${
                      elegida ? "border-icam-900 bg-icam-900/[0.04]" : "border-subtle hover:border-icam-900/40 hover:bg-page"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-text-primary">{ETIQUETA_AUDIENCIA[a]}</span>
                      <span className="block text-sm text-text-muted">{DESCRIPCION_AUDIENCIA[a]}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-xl font-semibold tabular-nums text-text-primary">{fmtInt(n)}</span>
                      <span className="block text-xs text-text-muted">{a === "promocion" ? "promociones" : "cuentas"}</span>
                    </span>
                    <Icono nombre="chevron" className="h-4 w-4 text-text-muted transition group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
            {recuento.sinDatoIntermediario > 0 ? (
              <p className="mt-2 text-xs text-text-muted">
                {fmtInt(recuento.sinDatoIntermediario)} cuentas aún no tienen el dato «Tiene intermediario» y no entran en
                «Inversores directos».
              </p>
            ) : null}
          </PreguntaGuiada>

          {audiencia === "promocion" ? (
            <PreguntaGuiada
              numero={numeroDe("promocion")}
              estado={estadoDe("promocion")}
              titulo="¿Qué promociones o fondos?"
              subtitulo="Marca una o varias. Una cuenta que esté en varias recibe un solo correo."
              respuesta={
                promocionesElegidas.length > 0 ? (
                  <>
                    {textoPromociones} <span className="font-normal text-text-muted">· {fmtInt(cuentasDePromociones)} cuentas</span>
                  </>
                ) : null
              }
              onCambiar={() => setEditando("promocion")}
            >
              <label className="relative mb-2 block">
                <span className="sr-only">Buscar promoción o fondo</span>
                <Icono nombre="buscar" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar promoción o fondo"
                  className={`${claseCampo} pl-8`}
                  autoFocus
                />
              </label>
              {promocionesElegidas.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {promocionesElegidas.map((p) => (
                    <button
                      key={p.zohoId}
                      type="button"
                      onClick={() => alternarPromocion(p.zohoId)}
                      className="inline-flex items-center gap-1 rounded-full bg-icam-900 py-1 pl-2.5 pr-1.5 text-xs font-medium text-white transition hover:bg-icam-800"
                      aria-label={`Quitar ${p.nombre}`}
                    >
                      {p.codigo ?? p.nombre}
                      <Icono nombre="cerrar" className="h-3 w-3 opacity-80" />
                    </button>
                  ))}
                </div>
              ) : null}
              <ul className="max-h-72 space-y-1 overflow-auto rounded-lg border border-subtle/60 p-1">
                {promocionesFiltradas.map((p) => {
                  const marcada = promociones.includes(p.zohoId);
                  return (
                    <li key={p.zohoId}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-icam-900/40 ${
                          marcada ? "bg-icam-900/[0.05]" : "hover:bg-page"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={() => alternarPromocion(p.zohoId)}
                          className="h-4 w-4 shrink-0 accent-icam-900"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium text-text-primary">{p.nombre}</span>
                          {p.codigo ? <span className="ml-2 text-xs text-text-muted">{p.codigo}</span> : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-text-muted">{fmtInt(p.numCuentas)} cuentas</span>
                      </label>
                    </li>
                  );
                })}
                {promocionesFiltradas.length === 0 ? (
                  <li className="px-3 py-4 text-center text-sm text-text-muted">Ninguna promoción con ese texto.</li>
                ) : null}
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-text-muted">
                  {promociones.length === 0 ? (
                    "Ninguna marcada todavía"
                  ) : (
                    <>
                      <strong className="text-text-primary">{promociones.length}</strong> marcadas ·{" "}
                      <strong className="text-text-primary">{fmtInt(cuentasDePromociones)}</strong> cuentas sin repetir
                    </>
                  )}
                </span>
                <Boton
                  variante="primario"
                  pequeno
                  disabled={promociones.length === 0}
                  onClick={() => {
                    setPromocionesListas(true);
                    setBusqueda("");
                    responder();
                  }}
                >
                  {promociones.length <= 1 ? "Usar esta" : `Usar estas ${promociones.length}`}
                  <Icono nombre="chevron" className="h-3 w-3" />
                </Boton>
              </div>
            </PreguntaGuiada>
          ) : null}

          <PreguntaGuiada
            numero={numeroDe("tipo")}
            estado={estadoDe("tipo")}
            titulo="¿Qué tipo de comunicación es?"
            subtitulo="Sirve para ordenarla en el historial y la analítica."
            respuesta={tipo ? ETIQUETA_TIPO[tipo] : null}
            onCambiar={() => setEditando("tipo")}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {TIPOS_COMUNICACION.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTipo(t);
                    responder();
                  }}
                  className={`rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 ${
                    tipo === t ? "border-icam-900 bg-icam-900/[0.04]" : "border-subtle hover:border-icam-900/40 hover:bg-page"
                  }`}
                >
                  <span className="block font-medium text-text-primary">{ETIQUETA_TIPO[t]}</span>
                  <span className="block text-xs text-text-muted">{DESCRIPCION_TIPO[t]}</span>
                </button>
              ))}
            </div>
          </PreguntaGuiada>

          <PreguntaGuiada
            numero={numeroDe("contactos")}
            estado={estadoDe("contactos")}
            ultima
            titulo="¿Quién de cada cuenta lo recibe?"
            subtitulo="Marca uno o varios papeles. Sale un correo por cuenta, no uno por persona."
            ayuda="Quien tiene un papel en «Para» recibe el correo; quien lo tiene en copia, va en copia. Nadie va a la vez en los dos. Los papeles son los del CRM."
            respuesta={textoContactos}
            onCambiar={() => setEditando("contactos")}
          >
            <div className="grid gap-2">
              {ROLES_CONTACTO.map((rol) => {
                const destino = papeles[rol];
                return (
                  <div
                    key={rol}
                    className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 transition ${
                      destino ? "border-icam-900 bg-icam-900/[0.04]" : "border-subtle hover:border-icam-900/40"
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(destino)}
                        onChange={() => alternarPapel(rol)}
                        className="h-4 w-4 shrink-0 accent-icam-900"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2 font-medium text-text-primary">
                          {ETIQUETA_ROL[rol]}
                          {rol === "principal" ? <Chip tono="marca">Lo habitual</Chip> : null}
                        </span>
                        <span className="block text-xs text-text-muted">{DESCRIPCION_ROL[rol]}</span>
                      </span>
                    </label>
                    {destino ? (
                      <div role="radiogroup" aria-label={`Cómo recibe ${ETIQUETA_ROL[rol]}`} className="inline-flex rounded-lg border border-subtle bg-card p-0.5 text-xs">
                        {(["para", "copia"] as const).map((d) => (
                          <button
                            key={d}
                            type="button"
                            role="radio"
                            aria-checked={destino === d}
                            onClick={() => {
                              setPapeles((p) => ({ ...p, [rol]: d }));
                              setContactosListos(false);
                            }}
                            className={`rounded-md px-2.5 py-1 font-medium transition ${
                              destino === d ? "bg-icam-900 text-white" : "text-text-muted hover:text-text-primary"
                            }`}
                          >
                            {d === "para" ? "Para" : "En copia"}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <span className={`text-sm ${rolesPara.length === 0 ? "text-red-700" : "text-text-muted"}`}>
                {rolesPara.length === 0 ? "Hace falta al menos un papel en «Para»." : textoContactos}
              </span>
              <Boton
                variante="primario"
                pequeno
                disabled={rolesPara.length === 0}
                onClick={() => {
                  setContactosListos(true);
                  responder();
                }}
              >
                Listo
                <Icono nombre="check" className="h-3 w-3" />
              </Boton>
            </div>
          </PreguntaGuiada>
        </ListaGuiada>

        {todoListo ? (
          <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
              <Icono nombre="check" className="h-4 w-4" />
            </span>
            <div className="min-w-0 text-sm text-green-900">
              <p className="font-semibold">Listo para preparar</p>
              <p>
                <strong>{ETIQUETA_TIPO[tipo as TipoComunicacion]}</strong> ·{" "}
                <strong>
                  {fmtInt(cuentas ?? 0)} cuentas
                  {audiencia === "promocion" ? ` de ${textoPromociones}` : ` · ${ETIQUETA_AUDIENCIA[audiencia as Audiencia]}`}
                </strong>{" "}
                · {textoContactos}.
              </p>
              <p className="mt-0.5 text-green-900/80">Al continuar verás la lista exacta, cuenta por cuenta.</p>
            </div>
          </div>
        ) : null}

        {aviso ? <Aviso tipo={aviso.ok ? "ok" : "error"}>{aviso.mensaje}</Aviso> : null}
      </PasoDelAsistente>
    </ModoFoco>
  );
}
