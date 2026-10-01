import type { ComponentType } from "react";

import { Contenido, ImagenMarco, Logo, PieConfidencial, Slide, SlideHeader, Subtitulo, Texto, Vinetas } from "./base";
import { Galeria, HitosResenables, ListaObjetivos, SlideKpisRiesgosObjetivos, TablaKpis, TablaRiesgos, Timeline, TimelineTrimestral } from "./datos";
import { Cierre, Disclaimer, Indice, Portada } from "./estructura";
import {
  DonutOcupacion,
  KpiIconosFinancieros,
  SlideBloqueado,
  TablaFinanciera,
  TablaLicitaciones,
  TablaMensual,
  TablaVarianzas,
} from "./finanzas";
import { AntecedentesNovedades, BloqueIcono, DosColumnas, MapaLateral, ResumenEjecutivo, TextoImagen } from "./narrativa";
import { BarraConsolidacion, BarrasBreeam, BreeamRating } from "./sostenibilidad";
import { Colaboradores, ConsejoAdministracion, FichasVehiculo, LogosColaboradores, VehiculoInversion } from "./vehiculo";

/**
 * Componentes que el JSON del informe puede nombrar en «c». Es la lista que se
 * valida al recibir un slide de Claude y la que describe
 * referencia/api-componentes.d.ts.txt (un test comprueba que coinciden).
 */
export const COMPONENTES = {
  Slide,
  SlideHeader,
  Contenido,
  Logo,
  PieConfidencial,
  Subtitulo,
  Texto,
  Vinetas,
  ImagenMarco,
  Portada,
  Indice,
  Disclaimer,
  Cierre,
  BloqueIcono,
  ResumenEjecutivo,
  AntecedentesNovedades,
  DosColumnas,
  TextoImagen,
  MapaLateral,
  TablaKpis,
  TablaRiesgos,
  ListaObjetivos,
  SlideKpisRiesgosObjetivos,
  Timeline,
  HitosResenables,
  TimelineTrimestral,
  Galeria,
  BreeamRating,
  BarrasBreeam,
  BarraConsolidacion,
  Colaboradores,
  LogosColaboradores,
  VehiculoInversion,
  FichasVehiculo,
  ConsejoAdministracion,
  SlideBloqueado,
  KpiIconosFinancieros,
  TablaVarianzas,
  TablaFinanciera,
  TablaLicitaciones,
  TablaMensual,
  DonutOcupacion,
} as const;

export type NombreComponente = keyof typeof COMPONENTES;

/** Etiquetas HTML que el JSON puede usar para agrupar. */
export const ETIQUETAS_HTML = ["div", "span", "p", "strong", "em", "br"] as const;

export function componente(nombre: string): ComponentType<Record<string, unknown>> | null {
  return (COMPONENTES as Record<string, unknown>)[nombre] as ComponentType<Record<string, unknown>> | null ?? null;
}

/** Nombres válidos en «c»: componentes + etiquetas HTML. */
export function componentesPermitidos(): string[] {
  return [...Object.keys(COMPONENTES), ...ETIQUETAS_HTML];
}
