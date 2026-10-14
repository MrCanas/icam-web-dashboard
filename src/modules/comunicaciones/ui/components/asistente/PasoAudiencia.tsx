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

/** Las combinaciones habituales de quién recibe el correo en cada cuenta. */
const PRESETS: { clave: string; titulo: string; detalle: string; para: RolContacto[]; copia: RolContacto[]; recomendado?: boolean }[] = [
  {
    clave: "principal",
    titulo: "Solo el contacto principal",
    detalle: "Lo habitual: una persona por cuenta.",
    para: ["principal"],
    copia: [],
    recomendado: true,
  },
  {
    clave: "principal_secundario",
    titulo: "El principal, con el secundario en copia",
    detalle: "Para que el segundo contacto también lo vea.",
    para: ["principal"],
    copia: ["secundario"],
  },
  {
    clave: "principal_y_secundario",
    titulo: "El principal y el secundario, los dos en «Para»",
    detalle: "Ambos como destinatarios directos.",
    para: ["principal", "secundario"],
    copia: [],
  },
];

type Pregunta = "zoho" | "audiencia" | "promocion" | "tipo" | "contactos";

const mismos = (a: RolContacto[], b: RolContacto[]) => a.length === b.length && a.every((r) => b.includes(r));

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
  const [promocion, setPromocion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<TipoComunicacion | "">("");
  const [rolesPara, setRolesPara] = useState<RolContacto[]>(["principal"]);
  const [rolesCopia, setRolesCopia] = useState<RolContacto[]>([]);
  const [contactosListos, setContactosListos] = useState(false);
  const [personalizando, setPersonalizando] = useState(false);
  const [editando, setEditando] = useState<Pregunta | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [preparando, empezarPreparar] = useTransition();
  const [actualizando, empezarActualizar] = useTransition();

  const promocionElegida = recuento.promociones.find((p) => p.zohoId === promocion);
  const cuentas =
    audiencia === "toda_la_base"
      ? recuento.todaLaBase
      : audiencia === "inversores_directos"
        ? recuento.inversoresDirectos
        : audiencia === "promocion"
          ? (promocionElegida?.numCuentas ?? null)
          : null;

  // Las preguntas, en orden, y si cada una está respondida.
  const preguntas: { clave: Pregunta; respondida: boolean }[] = [
    ...(datosDeHoy ? [] : [{ clave: "zoho" as const, respondida: false }]),
    { clave: "audiencia", respondida: audiencia !== "" },
    ...(audiencia === "promocion" ? [{ clave: "promocion" as const, respondida: promocion !== "" }] : []),
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

  const preset = PRESETS.find((p) => mismos(p.para, rolesPara) && mismos(p.copia, rolesCopia));
  const textoContactos = `${rolesPara.map((r) => ETIQUETA_ROL[r]).join(" y ") || "nadie"}${
    rolesCopia.length > 0 ? `, con ${rolesCopia.map((r) => ETIQUETA_ROL[r].toLowerCase()).join(" y ")} en copia` : ""
  }`;

  const preparar = () => {
    if (!todoListo) return;
    setAviso(null);
    empezarPreparar(async () => {
      try {
        const r = await prepararComunicacionAction({
          tipo: tipo as TipoComunicacion,
          audiencia: audiencia as Audiencia,
          promocionZohoId: promocion || null,
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
    promocion: "Elige la promoción o el fondo",
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
                      if (a !== "promocion") setPromocion("");
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
              titulo="¿Qué promoción o fondo?"
              subtitulo="Búscala por nombre o código."
              respuesta={
                promocionElegida ? (
                  <>
                    {promocionElegida.codigo ? `${promocionElegida.codigo} · ` : ""}
                    {promocionElegida.nombre}{" "}
                    <span className="font-normal text-text-muted">· {fmtInt(promocionElegida.numCuentas)} cuentas</span>
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
              <ul className="max-h-72 space-y-1 overflow-auto pr-1">
                {promocionesFiltradas.map((p) => {
                  const elegida = p.zohoId === promocion;
                  return (
                    <li key={p.zohoId}>
                      <button
                        type="button"
                        onClick={() => {
                          setPromocion(p.zohoId);
                          responder();
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 ${
                          elegida ? "border-icam-900 bg-icam-900/[0.04]" : "border-transparent hover:border-subtle hover:bg-page"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="font-medium text-text-primary">{p.nombre}</span>
                          {p.codigo ? <span className="ml-2 text-xs text-text-muted">{p.codigo}</span> : null}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-text-muted">{fmtInt(p.numCuentas)} cuentas</span>
                      </button>
                    </li>
                  );
                })}
                {promocionesFiltradas.length === 0 ? (
                  <li className="px-3 py-4 text-center text-sm text-text-muted">Ninguna promoción con ese texto.</li>
                ) : null}
              </ul>
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
            subtitulo="Sale un correo por cuenta, no uno por persona."
            ayuda="Quien tiene un papel marcado en «Para» recibe el correo; quien lo tiene en copia, va en copia. Nadie va a la vez en los dos. Los papeles son los del CRM."
            respuesta={textoContactos}
            onCambiar={() => {
              setEditando("contactos");
              setPersonalizando(!preset);
            }}
          >
            <div className="grid gap-2">
              {PRESETS.map((p) => {
                const elegido = !personalizando && preset?.clave === p.clave;
                return (
                  <button
                    key={p.clave}
                    type="button"
                    onClick={() => {
                      setRolesPara(p.para);
                      setRolesCopia(p.copia);
                      setPersonalizando(false);
                      setContactosListos(true);
                      responder();
                    }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 ${
                      elegido ? "border-icam-900 bg-icam-900/[0.04]" : "border-subtle hover:border-icam-900/40 hover:bg-page"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${elegido ? "border-icam-900" : "border-subtle"}`}
                    >
                      {elegido ? <span className="h-2 w-2 rounded-full bg-icam-900" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium text-text-primary">
                        {p.titulo}
                        {p.recomendado ? <Chip tono="marca">Recomendado</Chip> : null}
                      </span>
                      <span className="block text-xs text-text-muted">{p.detalle}</span>
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPersonalizando(true)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-icam-900/40 ${
                  personalizando ? "border-icam-900 bg-icam-900/[0.04]" : "border-subtle hover:border-icam-900/40 hover:bg-page"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${personalizando ? "border-icam-900" : "border-subtle"}`}
                >
                  {personalizando ? <span className="h-2 w-2 rounded-full bg-icam-900" /> : null}
                </span>
                <span>
                  <span className="block font-medium text-text-primary">Otra combinación</span>
                  <span className="block text-xs text-text-muted">Representante legal, abogado, intermediario…</span>
                </span>
              </button>
            </div>

            {personalizando ? (
              <div className="mt-3 space-y-3 rounded-xl border border-subtle bg-page/50 p-3">
                <div className="overflow-auto rounded-md border border-subtle bg-card">
                  <table className="w-full text-sm">
                    <thead className="bg-subtle/30">
                      <tr className="text-left">
                        <th scope="col" className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-icam-900">Papel en la cuenta</th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-icam-900">Para</th>
                        <th scope="col" className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-icam-900">Copia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ROLES_CONTACTO.map((rol) => (
                        <tr key={rol} className="border-t border-subtle/60">
                          <th scope="row" className="px-3 py-1.5 text-left font-normal text-text-body">
                            {ETIQUETA_ROL[rol]}
                          </th>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${ETIQUETA_ROL[rol]} en Para`}
                              checked={rolesPara.includes(rol)}
                              onChange={() => {
                                setRolesPara((l) => (l.includes(rol) ? l.filter((r) => r !== rol) : [...l, rol]));
                                // Nadie va a la vez en «Para» y en copia.
                                setRolesCopia((l) => l.filter((r) => r !== rol));
                              }}
                              className="accent-icam-900"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              aria-label={`${ETIQUETA_ROL[rol]} en copia`}
                              checked={rolesCopia.includes(rol)}
                              disabled={rolesPara.includes(rol)}
                              onChange={() => setRolesCopia((l) => (l.includes(rol) ? l.filter((r) => r !== rol) : [...l, rol]))}
                              className="accent-icam-900"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {rolesPara.length === 0 ? <span className="text-xs text-text-muted">Marca al menos un papel en «Para».</span> : null}
                  <Boton
                    variante="primario"
                    pequeno
                    disabled={rolesPara.length === 0}
                    onClick={() => {
                      setContactosListos(true);
                      responder();
                    }}
                  >
                    Usar esta combinación
                  </Boton>
                </div>
              </div>
            ) : null}
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
                  {audiencia === "promocion" && promocionElegida ? ` de ${promocionElegida.nombre}` : ` · ${ETIQUETA_AUDIENCIA[audiencia as Audiencia]}`}
                </strong>{" "}
                · lo recibe: {textoContactos.toLowerCase()}.
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
