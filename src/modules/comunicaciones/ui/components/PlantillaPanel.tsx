"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda, Desplegable } from "@/components/ui/Ayuda";
import { Boton } from "@/components/ui/Boton";
import { Campo, claseCampo } from "@/components/ui/Campo";
import { Chip } from "@/components/ui/Chip";
import { Icono } from "@/components/ui/Icono";
import { Tarjeta } from "@/components/ui/Tarjeta";
import {
  elegirPlantillaAction,
  listarPlantillasAction,
  vistaPreviaAction,
  type OpcionPlantilla,
  type VistaPreviaDeDestinatario,
} from "@/modules/comunicaciones/actions/comunicaciones";

interface Props {
  comunicacionId: string;
  plantillaId: string | null;
  plantillaNombre: string | null;
  /** Solo los que recibirían el correo: son los únicos con algo que previsualizar. */
  destinatarios: { id: string; nombre: string }[];
  editable: boolean;
}

const ETIQUETA_MODULO: Record<string, string> = {
  Cuentas_de_Inversi_n: "Cuentas de Inversión",
  Contacts: "Contactos",
};

/**
 * La plantilla del correo y cómo queda con los datos de un destinatario.
 *
 * Las plantillas siguen en Zoho CRM: aquí se eligen y se miran, no se editan.
 * La vista previa es el correo tal como lo monta el portal; lo que no sabe
 * resolver lo marca en rojo.
 */
export function PlantillaPanel({ comunicacionId, plantillaId, plantillaNombre, destinatarios, editable }: Props) {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState<OpcionPlantilla[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [elegidoId, setDestinatarioId] = useState(destinatarios[0]?.id ?? "");
  // La lista cambia al excluir o incluir a alguien: si el elegido ya no está (o
  // al cargar no había nadie), vale el primero, que es el que enseña el desplegable.
  const destinatarioId = destinatarios.some((d) => d.id === elegidoId) ? elegidoId : (destinatarios[0]?.id ?? "");
  const [vista, setVista] = useState<VistaPreviaDeDestinatario | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, empezar] = useTransition();

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!plantillas) return [];
    if (!q) return plantillas;
    return plantillas.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.carpeta ?? "").toLowerCase().includes(q) ||
        (p.asunto ?? "").toLowerCase().includes(q),
    );
  }, [plantillas, busqueda]);

  const cargarPlantillas = () =>
    empezar(async () => {
      setError(null);
      const r = await listarPlantillasAction();
      if (r.ok) setPlantillas(r.plantillas);
      else setError(r.mensaje);
    });

  const elegir = (id: string) =>
    empezar(async () => {
      setError(null);
      const r = await elegirPlantillaAction(comunicacionId, id);
      if (!r.ok) {
        setError(r.mensaje);
        return;
      }
      setVista(null);
      setPlantillas(null);
      router.refresh();
    });

  const previsualizar = (id: string) =>
    empezar(async () => {
      setError(null);
      const r = await vistaPreviaAction(comunicacionId, id);
      if (r.ok) setVista(r.vista);
      else {
        setVista(null);
        setError(r.mensaje);
      }
    });

  return (
    <Tarjeta
      id="com-plantilla"
      titulo="Plantilla"
      subtitulo="Se elige entre las del CRM y se siguen editando allí. Aquí se ve cómo queda para cada destinatario."
      acciones={
        editable && plantillas === null ? (
          <Boton variante={plantillaId ? "secundario" : "primario"} cargando={cargando} onClick={cargarPlantillas}>
            {plantillaId ? "Cambiar plantilla" : "Elegir plantilla"}
          </Boton>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {plantillaNombre ? (
          <>
            <Chip tono="ok">Elegida</Chip>
            <strong className="text-text-primary">{plantillaNombre}</strong>
          </>
        ) : (
          <>
            <Chip tono="aviso">Sin elegir</Chip>
            <span className="text-text-muted">Sin plantilla no hay prueba ni envío.</span>
          </>
        )}
      </div>

      {plantillas !== null ? (
        <div className="space-y-2 rounded-md border border-subtle p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[240px] flex-1">
              <span className="sr-only">Buscar plantilla</span>
              <Icono nombre="buscar" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, carpeta o asunto"
                className={`${claseCampo} pl-8`}
              />
            </label>
            <Boton variante="texto" onClick={() => setPlantillas(null)}>
              Cerrar
            </Boton>
          </div>
          <ul className="max-h-72 divide-y divide-subtle/60 overflow-auto rounded-md border border-subtle">
            {filtradas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-page/70">
                <span className="min-w-0">
                  <span className="block font-medium text-text-primary">{p.nombre}</span>
                  <span className="block text-xs text-text-muted">
                    {ETIQUETA_MODULO[p.modulo ?? ""] ?? p.modulo ?? "—"}
                    {p.carpeta ? ` · ${p.carpeta}` : ""}
                    {p.asunto ? ` · ${p.asunto}` : ""}
                  </span>
                </span>
                <Boton variante={p.id === plantillaId ? "texto" : "secundario"} pequeno disabled={cargando} onClick={() => elegir(p.id)}>
                  {p.id === plantillaId ? "Elegida" : "Elegir"}
                </Boton>
              </li>
            ))}
            {filtradas.length === 0 ? <li className="px-3 py-4 text-center text-sm text-text-muted">Ninguna plantilla con ese texto.</li> : null}
          </ul>
        </div>
      ) : null}

      {plantillaId && destinatarios.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-subtle pt-3">
          <div className="min-w-[260px] flex-1">
            <Campo etiqueta="Ver cómo le llegaría a">
              <select
                value={destinatarioId}
                onChange={(e) => {
                  setDestinatarioId(e.target.value);
                  setVista(null);
                }}
                className={claseCampo}
              >
                {destinatarios.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <Boton variante="secundario" cargando={cargando} disabled={!destinatarioId} onClick={() => previsualizar(destinatarioId)}>
            Ver vista previa
          </Boton>
        </div>
      ) : null}

      {plantillaId && destinatarios.length === 0 ? (
        <p className="text-sm text-text-muted">No hay ningún destinatario que fuera a recibir el correo, así que no hay nada que previsualizar.</p>
      ) : null}

      {error ? <Aviso tipo="error">{error}</Aviso> : null}

      {vista ? (
        <div className="space-y-3">
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-text-muted">Asunto</dt>
            <dd className="font-medium text-text-primary">{vista.asunto || "(sin asunto)"}</dd>
            <dt className="text-text-muted">Para</dt>
            <dd className="text-text-body">{vista.para.join(", ")}</dd>
            {vista.copia.length > 0 ? (
              <>
                <dt className="text-text-muted">Copia</dt>
                <dd className="text-text-body">{vista.copia.join(", ")}</dd>
              </>
            ) : null}
            <dt className="text-text-muted">Datos de</dt>
            <dd className="text-text-body">{vista.registroNombre}</dd>
            <dt className="text-text-muted">Adjuntos</dt>
            <dd className="text-text-body">{vista.adjuntos.length > 0 ? vista.adjuntos.join(", ") : "Ninguno"}</dd>
            <dt className="text-text-muted">Seguimiento</dt>
            <dd className="flex flex-wrap items-center gap-1.5 text-text-body">
              <Chip tono="neutro">{vista.imagen === "logo" ? "logotipo al pie" : "imagen invisible"}</Chip>
              <Chip tono="neutro">enlaces por go.imparcapital.com</Chip>
              <Ayuda>
                {vista.imagen === "logo"
                  ? "La plantilla no trae imágenes: se le añade el logotipo de Impar Capital al pie, como se ve abajo, para poder saber si se abre."
                  : "Se le añade una imagen invisible para saber si se abre."}{" "}
                Al enviar, cada enlace pasa por go.imparcapital.com y vuelve a su destino; así se sabe quién pulsa.
              </Ayuda>
            </dd>
          </dl>

          {vista.sinResolver.length > 0 ? (
            <Aviso tipo="error" titulo="Con esta plantilla el correo no saldría">
              Usa campos que el portal no sabe resolver (marcados en rojo): {vista.sinResolver.join(", ")}. Son campos de
              otro módulo, la firma del usuario, o importes y fechas, que Zoho escribe a su manera.
            </Aviso>
          ) : null}
          {vista.vacios.length > 0 ? (
            <Aviso tipo="aviso" titulo="Campos vacíos para este destinatario, que saldrían en blanco">
              {vista.vacios.join(", ")}
            </Aviso>
          ) : null}

          {/* `sandbox` sin permisos: el HTML de la plantilla no ejecuta scripts ni navega. */}
          <iframe
            title={`Vista previa de ${vista.plantillaNombre}`}
            sandbox=""
            srcDoc={vista.html}
            className="h-[640px] w-full rounded-md border border-subtle bg-white"
          />
          <Desplegable titulo="Por qué puede verse distinto al correo real">
            <p>
              Así lo monta el portal. Las imágenes de la plantilla solo se ven aquí si tienes abierta la sesión de Zoho;
              al enviar, Zoho las incrusta en el correo. La comprobación fiel es el envío de prueba.
            </p>
          </Desplegable>
        </div>
      ) : null}
    </Tarjeta>
  );
}
