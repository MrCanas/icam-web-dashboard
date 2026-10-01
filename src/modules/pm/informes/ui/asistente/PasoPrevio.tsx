"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { accionAnadirFuente, accionBorrarFuente, accionObtenerPrevio } from "../../actions/informes";
import { previoPorDefecto } from "../../logic/fuentes-auto";
import { rutaInforme } from "../../logic/paths";
import { qAnt } from "../../logic/trimestre";
import type { BaseInforme } from "../../types";
import { Boton, Chip, ChipEstado, fechaCorta, Tarjeta } from "../componentes";
import type { HerramientaInforme } from "../InformeApp";
import { extraerTexto } from "../lib/ficheros";
import { ZonaSoltar } from "./ZonaSoltar";

type Opcion = "portal" | "fichero" | "ninguno";

function OpcionPrevio({
  valor,
  actual,
  onElegir,
  titulo,
  children,
}: {
  valor: Opcion;
  actual: Opcion;
  onElegir: (o: Opcion) => void;
  titulo: string;
  children?: ReactNode;
}) {
  const activa = valor === actual;
  return (
    <div className={`rounded-lg border p-3 ${activa ? "border-icam-900/40 bg-page" : "border-subtle/60"}`}>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text-primary">
        <input type="radio" name="opcion-previo" checked={activa} onChange={() => onElegir(valor)} />
        {titulo}
      </label>
      {activa && children ? <div className="mt-3 space-y-3">{children}</div> : null}
    </div>
  );
}

/** Paso 1 · Informe anterior: uno de los del proyecto guardados en el portal, un PDF/PPTX leído en el navegador o ninguno. */
export function PasoPrevio({ h }: { h: HerramientaInforme }) {
  const { informe, candidatos, fuentes, puedeEditar } = h;
  const textoPrevio = fuentes.find((f) => f.tipo === "previo") ?? null;
  const trimestreAnterior = qAnt(informe.trimestre);
  const [opcion, setOpcion] = useState<Opcion>(() => {
    if (informe.base?.tipo === "texto") return "fichero";
    if (informe.base?.tipo === "ninguno") return "ninguno";
    return candidatos.length ? "portal" : "fichero";
  });
  const [elegido, setElegido] = useState(() => previoPorDefecto(candidatos, informe.base, trimestreAnterior));
  const [ocupado, setOcupado] = useState<string | null>(null);
  const candidato = candidatos.find((c) => c.id === elegido) ?? null;

  async function subir(files: File[]) {
    const file = files[0];
    if (!file) return;
    setOcupado(`Leyendo ${file.name}…`);
    try {
      const texto = await extraerTexto(file);
      if (!texto.trim()) throw new Error("no tiene texto (¿es un PDF escaneado?)");
      if (textoPrevio) await accionBorrarFuente(informe.id, textoPrevio.id);
      const r = await accionAnadirFuente(informe.id, { tipo: "previo", nombre: file.name, texto });
      if (!r.ok) throw new Error(r.error);
      h.setFuentes((fs) => [...fs.filter((f) => f.tipo !== "previo"), r.data]);
      h.avisar(null);
    } catch (e) {
      h.avisar(`No se ha podido leer ${file.name}: ${e instanceof Error ? e.message : "error"}`, "error");
    } finally {
      setOcupado(null);
    }
  }

  async function continuar() {
    let base: BaseInforme;
    if (opcion === "portal" && candidato) {
      if (h.previo?.id !== candidato.id) {
        setOcupado(`Abriendo el informe ${candidato.trimestre}…`);
        const r = await accionObtenerPrevio(informe.id, candidato.id).catch(() => null);
        setOcupado(null);
        if (!r?.ok) {
          h.avisar(`No se ha podido abrir el informe ${candidato.trimestre}${r ? `: ${r.error}` : ""}. Vuelve a intentarlo.`, "error");
          return;
        }
        h.setPrevio(r.data);
      }
      base = { tipo: "estructurado", id: candidato.id };
    } else if (opcion === "fichero" && textoPrevio) {
      h.setPrevio(null);
      base = { tipo: "texto", nombre: textoPrevio.nombre };
    } else {
      h.setPrevio(null);
      base = { tipo: "ninguno" };
    }
    // El análisis parte del informe anterior: si cambia, hay que repetirlo.
    const cambia = !!informe.base && JSON.stringify(informe.base) !== JSON.stringify(base);
    const reanalizar = cambia && informe.estado === "analizado";
    const ok = await h.guardar(
      {
        base,
        trimestreAnterior: base.tipo === "estructurado" && candidato ? candidato.trimestre : trimestreAnterior,
        estado: informe.estado === "datos" || reanalizar ? "fuentes" : informe.estado,
      },
      cambia ? "Informe anterior cambiado" : undefined,
    );
    if (!ok) {
      h.avisar("No se ha podido guardar el paso. Vuelve a intentarlo.", "error");
      return;
    }
    h.ir("paso2");
    if (cambia && informe.analisis) h.avisar("Has cambiado el informe anterior: vuelve a analizar la información para que la estructura parta de él.");
  }

  const listo = opcion === "portal" ? !!candidato : opcion === "fichero" ? !!textoPrevio : true;

  return (
    <Tarjeta>
      <h2 className="text-sm font-semibold text-text-primary">Informe anterior</h2>
      <p className="text-sm text-text-muted">
        Es el punto de partida del informe del <b>{informe.trimestre}</b>: se conserva su estructura y se actualiza lo que ha cambiado. Elige uno
        de los informes del proyecto o sube el que quieras.
      </p>
      <fieldset className="space-y-2" disabled={!puedeEditar || !!ocupado}>
        <legend className="sr-only">Informe anterior</legend>
        {candidatos.length ? (
          <OpcionPrevio valor="portal" actual={opcion} onElegir={setOpcion} titulo="Un informe del proyecto guardado en el portal">
            <ul className="divide-y divide-subtle/60 rounded-lg border border-subtle/60 bg-card">
              {candidatos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                  <label className="flex flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                    <input type="radio" name="informe-previo" checked={elegido === c.id} onChange={() => setElegido(c.id)} />
                    <b className="font-semibold tabular-nums text-text-primary">{c.trimestre}</b>
                    <ChipEstado estado={c.estado} />
                    {c.trimestre === trimestreAnterior ? <Chip tono="marca">trimestre anterior</Chip> : null}
                    <span className="text-xs text-text-muted">
                      v{c.version} · {c.slides} slides · {fechaCorta(c.actualizado)}
                    </span>
                  </label>
                  <Link href={rutaInforme(c.id)} target="_blank" className="text-xs font-medium text-icam-900 hover:underline">
                    Abrir
                  </Link>
                </li>
              ))}
            </ul>
            {candidato && candidato.trimestre !== trimestreAnterior ? (
              <p className="text-sm text-text-muted">
                No es el del {trimestreAnterior}: el informe se preparará tomando el <b>{candidato.trimestre}</b> como trimestre anterior.
              </p>
            ) : null}
          </OpcionPrevio>
        ) : null}
        <OpcionPrevio valor="fichero" actual={opcion} onElegir={setOpcion} titulo="Subir un informe en PDF o PowerPoint">
          {textoPrevio ? (
            <div className="space-y-2">
              <p className="rounded-md border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-900">
                Informe anterior leído: <b>{textoPrevio.nombre}</b> · {textoPrevio.texto.length.toLocaleString("es-ES")} caracteres.
              </p>
              <details>
                <summary className="cursor-pointer text-sm text-text-muted">Ver el texto extraído</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-card p-3 text-xs">{textoPrevio.texto.slice(0, 4000)}</pre>
              </details>
            </div>
          ) : (
            <p className="text-sm">Se lee en tu navegador; solo se guarda el texto.</p>
          )}
          {puedeEditar ? (
            <ZonaSoltar acepta=".pdf,.pptx" onFicheros={subir} deshabilitado={!!ocupado}>
              {textoPrevio ? "Arrastra otro PDF o PPTX para sustituirlo, o pulsa para elegirlo" : "Arrastra aquí el PDF o PPTX, o pulsa para elegirlo"}
            </ZonaSoltar>
          ) : null}
        </OpcionPrevio>
        <OpcionPrevio valor="ninguno" actual={opcion} onElegir={setOpcion} titulo="No hay informe anterior (proyecto nuevo)" />
      </fieldset>
      {ocupado ? (
        <p className="text-sm text-text-muted" aria-live="polite">
          {ocupado}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" onClick={() => void continuar()} disabled={!listo || !puedeEditar || !!ocupado}>
          Continuar
        </Boton>
      </div>
    </Tarjeta>
  );
}
