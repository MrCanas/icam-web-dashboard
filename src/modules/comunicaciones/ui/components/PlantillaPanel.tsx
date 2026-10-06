"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

const BOTON =
  "min-h-9 rounded-md border border-subtle px-3 py-1.5 text-sm text-text-body hover:border-icam-900 disabled:opacity-60";
const CAMPO = "block w-full rounded-md border border-subtle bg-card px-3 py-2 text-sm text-text-body";

/**
 * La plantilla del correo y cómo queda con los datos de un destinatario.
 *
 * Las plantillas siguen en Zoho CRM: aquí se eligen y se miran, no se editan.
 * La vista previa imita la sustitución de campos que hará Zoho; lo que no sabe
 * resolver lo marca en rojo.
 */
export function PlantillaPanel({ comunicacionId, plantillaId, plantillaNombre, destinatarios, editable }: Props) {
  const router = useRouter();
  const [plantillas, setPlantillas] = useState<OpcionPlantilla[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [destinatarioId, setDestinatarioId] = useState(destinatarios[0]?.id ?? "");
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
    <section className="space-y-2" aria-labelledby="com-plantilla">
      <h2 id="com-plantilla" className="text-base font-semibold text-text-primary">
        Plantilla
      </h2>

      <div className="space-y-3 rounded-lg border border-subtle/50 bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-body">
          <span>
            {plantillaNombre ? (
              <>
                Plantilla elegida: <strong className="text-text-primary">{plantillaNombre}</strong>
              </>
            ) : (
              "Todavía no se ha elegido plantilla."
            )}
          </span>
          {editable && plantillas === null ? (
            <button type="button" disabled={cargando} onClick={cargarPlantillas} className={BOTON}>
              {cargando ? "Leyendo plantillas de Zoho…" : plantillaId ? "Cambiar plantilla" : "Elegir plantilla"}
            </button>
          ) : null}
        </div>

        {plantillas !== null ? (
          <div className="space-y-2">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, carpeta o asunto"
              aria-label="Buscar plantilla"
              className={CAMPO}
            />
            <ul className="max-h-72 divide-y divide-subtle/60 overflow-auto rounded-md border border-subtle">
              {filtradas.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium text-text-primary">{p.nombre}</span>
                    <span className="block text-xs text-text-muted">
                      {ETIQUETA_MODULO[p.modulo ?? ""] ?? p.modulo ?? "—"}
                      {p.carpeta ? ` · ${p.carpeta}` : ""}
                      {p.asunto ? ` · ${p.asunto}` : ""}
                    </span>
                  </span>
                  <button type="button" disabled={cargando} onClick={() => elegir(p.id)} className={BOTON}>
                    {p.id === plantillaId ? "Elegida" : "Elegir"}
                  </button>
                </li>
              ))}
              {filtradas.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-text-muted">Ninguna plantilla con ese texto.</li>
              ) : null}
            </ul>
            <button type="button" onClick={() => setPlantillas(null)} className={BOTON}>
              Cerrar la lista
            </button>
          </div>
        ) : null}

        {plantillaId && destinatarios.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-subtle pt-3">
            <label className="min-w-[260px] flex-1 text-sm text-text-body">
              Ver cómo le llegaría a
              <select
                value={destinatarioId}
                onChange={(e) => {
                  setDestinatarioId(e.target.value);
                  setVista(null);
                }}
                className={`${CAMPO} mt-1`}
              >
                {destinatarios.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={cargando || !destinatarioId}
              onClick={() => previsualizar(destinatarioId)}
              className={BOTON}
            >
              {cargando ? "Montando…" : "Ver vista previa"}
            </button>
          </div>
        ) : null}

        {plantillaId && destinatarios.length === 0 ? (
          <p className="text-sm text-text-muted">
            No hay ningún destinatario que fuera a recibir el correo, así que no hay nada que previsualizar.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-[#9B3B3B]">
            {error}
          </p>
        ) : null}

        {vista ? (
          <div className="space-y-2">
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
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
            </dl>

            {vista.sinResolver.length > 0 ? (
              <p className="text-sm text-[#9B3B3B]">
                Campos que esta vista previa no sabe resolver (marcados en rojo): {vista.sinResolver.join(", ")}
              </p>
            ) : null}
            {vista.vacios.length > 0 ? (
              <p className="text-sm text-[#9B3B3B]">
                Campos vacíos para este destinatario, que saldrían en blanco: {vista.vacios.join(", ")}
              </p>
            ) : null}

            {/* `sandbox` sin permisos: el HTML de la plantilla no ejecuta scripts ni navega. */}
            <iframe
              title={`Vista previa de ${vista.plantillaNombre}`}
              sandbox=""
              srcDoc={vista.html}
              className="h-[640px] w-full rounded-md border border-subtle bg-white"
            />
            <p className="text-xs text-text-muted">
              Es una imitación de lo que hará Zoho al enviar. La comprobación fiel será el envío de prueba.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
