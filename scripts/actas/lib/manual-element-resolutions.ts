import { normalizeKey } from "./normalize";

/**
 * Resolución manual persistente: nombre Monday → elemento del catálogo maestro.
 * Se aplica en la cascada del matcher (paso `manual_resolution`), en cualquier scope.
 */
export interface ManualElementResolution {
  monday_name: string;
  master_element_name: string;
  master_group_name: string;
  reason: string;
}

/**
 * Resolución manual padre → subitem (cuando el contexto padre no basta).
 * Se evalúa en `parent_context` antes del match automático entre hijos del catálogo.
 */
export interface ManualParentChildResolution {
  parent_item: string;
  subitem: string;
  master_element_name: string;
  master_group_name: string;
  reason: string;
}

const LEYENDA_V2 = "Leyenda catálogo v2 / docs/actas/catalogo-maestro.xlsx";

export const MANUAL_ELEMENT_RESOLUTIONS: Record<string, ManualElementResolution> =
  {
    [normalizeKey("Saneamiento")]: {
      monday_name: "Saneamiento",
      master_element_name: "Saneamiento",
      master_group_name: "PROPERTY MANAGEMENT",
      reason:
        "En snapshots (p. ej. GQ8, VE1) el ítem suele estar en ESTADO PROYECTO o subitems; en catálogo maestro está en PROPERTY MANAGEMENT.",
    },
    [normalizeKey("Comunidad de propietarios")]: {
      monday_name: "Comunidad de propietarios",
      master_element_name: "Comunidad de Propietarios",
      master_group_name: "PROPERTY MANAGEMENT",
      reason:
        "Monday usa «Comunidad de propietarios» bajo ESTADO PROYECTO; catálogo: «Comunidad de Propietarios» en PROPERTY MANAGEMENT.",
    },
    [normalizeKey("CT")]: {
      monday_name: "CT",
      master_element_name: "Centro de Transformación (CT)",
      master_group_name: "ESTADO PROYECTO",
      reason: `${LEYENDA_V2}: abreviatura Monday en ESTADO PROYECTO.`,
    },
    [normalizeKey("CT / LGA")]: {
      monday_name: "CT / LGA",
      master_element_name: "Centro de Transformación (CT)",
      master_group_name: "ESTADO PROYECTO",
      reason: `${LEYENDA_V2}: ítem compuesto CT/LGA → Centro de Transformación (CT).`,
    },
    [normalizeKey("LGA")]: {
      monday_name: "LGA",
      master_element_name: "Centro de Transformación (CT)",
      master_group_name: "ESTADO PROYECTO",
      reason: `${LEYENDA_V2}: LGA se trata como CT en migración (entrada duplicada).`,
    },
    [normalizeKey("Inquilino KAWAI")]: {
      monday_name: "Inquilino KAWAI",
      master_element_name: "Inquilino existente",
      master_group_name: "ESTADO PROYECTO",
      reason: `${LEYENDA_V2}: nombre de inquilino específico → genérico «Inquilino existente».`,
    },
    [normalizeKey("Proyecto")]: {
      monday_name: "Proyecto",
      master_element_name: "Proyecto Arquitectura",
      master_group_name: "ESTADO PROYECTO",
      reason: `${LEYENDA_V2}: «Proyecto» en ESTADO PROYECTO → «Proyecto Arquitectura».`,
    },
    [normalizeKey("Obra")]: {
      monday_name: "Obra",
      master_element_name: "Inicio Obra",
      master_group_name: "ESTADO PROYECTO",
      reason: `${LEYENDA_V2}: «Obra» en ESTADO PROYECTO → «Inicio Obra».`,
    },
    [normalizeKey("Préstamo Villages")]: {
      monday_name: "Préstamo Villages",
      master_element_name: "Préstamo Promotor",
      master_group_name: "FINANCIACIÓN",
      reason: `${LEYENDA_V2}: préstamo concreto → tramo «Préstamo Promotor».`,
    },
    [normalizeKey("Operador")]: {
      monday_name: "Operador",
      master_element_name: "Operador (técnico)",
      master_group_name: "ESTADO PROYECTO",
      reason: `${LEYENDA_V2}: Operador en BUSINESS PLAN / LUCHANA → «Operador (técnico)» en ESTADO PROYECTO.`,
    },
    [normalizeKey("Anteproyecto")]: {
      monday_name: "Anteproyecto",
      master_element_name: "Anteproyecto (accesorio)",
      master_group_name: "ACTIVO ACCESORIO VINCULADO",
      reason: `${LEYENDA_V2}: Anteproyecto en grupo SOLAR ALFONSO XIII → accesorio vinculado.`,
    },
    [normalizeKey("Situación renta - Bajo Dª")]: {
      monday_name: "Situación renta - Bajo Dª",
      master_element_name: "Situación de rentas",
      master_group_name: "COMERCIAL",
      reason: `${LEYENDA_V2}: instancia custom → «Situación de rentas» (Estado de arrendamiento).`,
    },
    [normalizeKey("Situación renta - FarHome")]: {
      monday_name: "Situación renta - FarHome",
      master_element_name: "Situación de rentas",
      master_group_name: "COMERCIAL",
      reason: `${LEYENDA_V2}: instancia custom → «Situación de rentas» (Estado de arrendamiento).`,
    },
  };

const SUMINISTROS_PARENT = "Suministros";
const PM_GROUP = "PROPERTY MANAGEMENT";
const FIN_GROUP = "FINANCIACIÓN";

export const MANUAL_PARENT_CHILD_RESOLUTIONS: ManualParentChildResolution[] = [
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Ascensor",
    master_element_name: "Mantenimiento de ascensores",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Seguridad",
    master_element_name: "Seguridad y alarma",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Alarma",
    master_element_name: "Seguridad y alarma",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Luz",
    master_element_name: "Electricidad",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Extintores",
    master_element_name: "Mantenimiento de extintores",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Mantenimiento PCI",
    master_element_name: "PCI",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → «PCI» en catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Incendios",
    master_element_name: "PCI",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → «PCI» en catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Incendios | PCI",
    master_element_name: "PCI",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → «PCI» en catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Pararayos",
    master_element_name: "Pararayos y toma de tierra",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Comun",
    master_element_name: "Agua",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → «Agua» en catálogo PM.`,
  },
  {
    parent_item: SUMINISTROS_PARENT,
    subitem: "Resto",
    master_element_name: "Agua",
    master_group_name: PM_GROUP,
    reason: `${LEYENDA_V2}: subitem Suministros → «Agua» en catálogo PM.`,
  },
  {
    parent_item: "Tramo suelo",
    subitem: "Intereses",
    master_element_name: "Interés",
    master_group_name: FIN_GROUP,
    reason: `${LEYENDA_V2}: subitem tramo financiación → «Interés».`,
  },
  {
    parent_item: "Tramo construcción",
    subitem: "Intereses",
    master_element_name: "Interés",
    master_group_name: FIN_GROUP,
    reason: `${LEYENDA_V2}: subitem tramo financiación → «Interés».`,
  },
  {
    parent_item: "Préstamo Promotor",
    subitem: "Intereses",
    master_element_name: "Interés",
    master_group_name: FIN_GROUP,
    reason: `${LEYENDA_V2}: subitem tramo financiación → «Interés».`,
  },
  {
    parent_item: "Prestamo Promotor y Suelo",
    subitem: "Intereses",
    master_element_name: "Interés",
    master_group_name: FIN_GROUP,
    reason:
      "Monday agrupa tramos bajo «Prestamo Promotor y Suelo»; catálogo v2: subitem → «Interés».",
  },
  {
    parent_item: "Tramo suelo",
    subitem: "Plazo financiaciamiento",
    master_element_name: "Plazo",
    master_group_name: FIN_GROUP,
    reason: `${LEYENDA_V2}: typo Monday «Plazo financiaciamiento» → «Plazo».`,
  },
];

export function findManualElementResolution(
  mondayName: string,
): ManualElementResolution | null {
  return MANUAL_ELEMENT_RESOLUTIONS[normalizeKey(mondayName)] ?? null;
}

export function findManualParentChildResolution(
  parentItem: string,
  subitem: string,
): ManualParentChildResolution | null {
  const p = normalizeKey(parentItem);
  const s = normalizeKey(subitem);
  return (
    MANUAL_PARENT_CHILD_RESOLUTIONS.find(
      (r) => normalizeKey(r.parent_item) === p && normalizeKey(r.subitem) === s,
    ) ?? null
  );
}
