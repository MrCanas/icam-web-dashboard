"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { accionCrearInforme } from "../../actions/informes";
import { rutaInforme, rutaListaInformes } from "../../logic/paths";
import { qAnt, qSig } from "../../logic/trimestre";
import type { Pie } from "../../slides/tipos";
import { ARQUETIPOS, type Arquetipo, type ProyectoInforme } from "../../types";
import { Aviso, Boton, Campo, claseCampo, Pasos, Tarjeta } from "../componentes";

interface Props {
  proyectos: ProyectoInforme[];
  /** Activo elegido al entrar desde la subpestaña de un proyecto. */
  activoInicial: string | null;
  trimestres: string[];
  trimestrePorDefecto: string;
  puedeEditar: boolean;
  error: string | null;
}

const NUEVO = "__nuevo";

/** Paso 0 · Datos del informe: proyecto y trimestres. */
export function PasoDatos({ proyectos, activoInicial, trimestres, trimestrePorDefecto, puedeEditar, error }: Props) {
  const router = useRouter();
  const inicial = useMemo(() => {
    const porActivo = activoInicial ? proyectos.find((p) => p.idActivo === activoInicial) : null;
    return porActivo?.codigo ?? proyectos[0]?.codigo ?? NUEVO;
  }, [proyectos, activoInicial]);

  const [codigo, setCodigo] = useState(inicial);
  const [qNew, setQNew] = useState(trimestrePorDefecto);
  const [qPrev, setQPrev] = useState(qAnt(trimestrePorDefecto));
  const [nombre, setNombre] = useState("");
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [arquetipo, setArquetipo] = useState<Arquetipo>("A");
  const [variante, setVariante] = useState<"cnmv" | "sl">("cnmv");
  const [fondo, setFondo] = useState("");
  const [isin, setIsin] = useState("");
  const [vehiculo, setVehiculo] = useState("");
  const [nif, setNif] = useState("");
  const [vincular, setVincular] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(error);
  const [pendiente, empezar] = useTransition();

  const sel = proyectos.find((p) => p.codigo === codigo) ?? null;
  const nuevo = codigo === NUEVO;
  const configurar = nuevo || (sel ? !sel.configurado : false);
  const libres = proyectos.filter((p) => !p.configurado && p.idActivo);

  function pie(): Pie {
    return variante === "cnmv" ? { variante: "cnmv", tipo: "fondo", fondo, isin } : { variante: "sl", vehiculo, nif };
  }

  function continuar() {
    setMensaje(null);
    if (qSig(qPrev) !== qNew) {
      setMensaje(`El trimestre nuevo debe ser el siguiente al anterior (${qSig(qPrev)}).`);
      return;
    }
    empezar(async () => {
      try {
        const r = await accionCrearInforme({
          codigo: nuevo ? "" : codigo,
          nombre: nuevo ? nombre : sel?.nombre,
          codigoNuevo: nuevo ? codigoNuevo : undefined,
          idActivo: configurar ? (sel?.idActivo ?? null) : vincular || null,
          arquetipo,
          pie: configurar ? pie() : null,
          trimestre: qNew,
          trimestreAnterior: qPrev,
          configurar: !nuevo && configurar,
        });
        if (!r.ok) {
          setMensaje(r.error);
          window.scrollTo(0, 0);
          return;
        }
        router.push(rutaInforme(r.data.id) + (r.data.existia ? "?existia=1" : ""));
      } catch (err) {
        setMensaje(`No se ha podido preparar el informe: ${err instanceof Error ? err.message : "error"}. Vuelve a intentarlo.`);
      }
    });
  }

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-text-primary">Nuevo informe</h1>
        <Link href={rutaListaInformes()} className="text-sm font-medium text-icam-900 hover:underline">
          Volver a la lista
        </Link>
      </div>
      <Pasos actual={0} />
      {mensaje ? <Aviso tipo="error">{mensaje}</Aviso> : null}
      {!puedeEditar ? <Aviso>Tu acceso a Proyectos es de lectura: no puedes crear informes.</Aviso> : null}
      <Tarjeta>
        <h2 className="text-sm font-semibold text-text-primary">¿Qué informe vamos a preparar?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Proyecto">
            <select className={claseCampo} value={codigo} onChange={(e) => setCodigo(e.target.value)}>
              {proyectos.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.nombre} · {p.codigo}
                  {p.configurado ? "" : " (sin configurar)"}
                </option>
              ))}
              <option value={NUEVO}>Otro proyecto…</option>
            </select>
          </Campo>
          <Campo etiqueta="Trimestre anterior">
            <select
              className={claseCampo}
              value={qPrev}
              onChange={(e) => {
                setQPrev(e.target.value);
                setQNew(qSig(e.target.value));
              }}
            >
              {trimestres.map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Trimestre nuevo">
            <select
              className={claseCampo}
              value={qNew}
              onChange={(e) => {
                setQNew(e.target.value);
                setQPrev(qAnt(e.target.value));
              }}
            >
              {trimestres.map((q) => (
                <option key={q}>{q}</option>
              ))}
            </select>
          </Campo>
        </div>

        {configurar ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {nuevo ? (
                <>
                  <Campo etiqueta="Nombre del proyecto">
                    <input className={claseCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Santa Engracia 84" />
                  </Campo>
                  <Campo etiqueta="Código corto">
                    <input className={claseCampo} value={codigoNuevo} onChange={(e) => setCodigoNuevo(e.target.value)} placeholder="SE84" />
                  </Campo>
                </>
              ) : null}
              <Campo etiqueta="Tipo de proyecto">
                <select className={claseCampo} value={arquetipo} onChange={(e) => setArquetipo(e.target.value as Arquetipo)}>
                  {ARQUETIPOS.map((a) => (
                    <option key={a.valor} value={a.valor}>
                      {a.etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Vehículo">
                <select className={claseCampo} value={variante} onChange={(e) => setVariante(e.target.value as "cnmv" | "sl")}>
                  <option value="cnmv">Fondo CNMV (ISIN)</option>
                  <option value="sl">Sociedad (NIF)</option>
                </select>
              </Campo>
              {variante === "cnmv" ? (
                <>
                  <Campo etiqueta="Nombre del fondo">
                    <input className={claseCampo} value={fondo} onChange={(e) => setFondo(e.target.value)} />
                  </Campo>
                  <Campo etiqueta="ISIN">
                    <input className={claseCampo} value={isin} onChange={(e) => setIsin(e.target.value)} />
                  </Campo>
                </>
              ) : (
                <>
                  <Campo etiqueta="Sociedad">
                    <input className={claseCampo} value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} />
                  </Campo>
                  <Campo etiqueta="NIF">
                    <input className={claseCampo} value={nif} onChange={(e) => setNif(e.target.value)} />
                  </Campo>
                </>
              )}
            </div>
            <p className="text-sm text-text-muted">
              Los datos del vehículo salen en el pie legal de cada página. Si hay informe anterior, se toman de él.
            </p>
          </>
        ) : null}

        {!configurar && sel && !sel.idActivo ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Activo de Proyectos (para cargar actas y planificación)"
              ayuda="Este proyecto no está vinculado a un activo: sin vínculo, las actas y la planificación se añaden a mano."
            >
              <select className={claseCampo} value={vincular} onChange={(e) => setVincular(e.target.value)}>
                <option value="">Sin vincular</option>
                {libres.map((p) => (
                  <option key={p.idActivo!} value={p.idActivo!}>
                    {p.nombre} · {p.idActivo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Boton variante="primario" onClick={continuar} disabled={!puedeEditar || pendiente}>
            {pendiente ? "Preparando…" : "Continuar"}
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}
