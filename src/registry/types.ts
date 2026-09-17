export interface ModuleRoute {
  key: string;
  path: string;
  label: string;
  /** When set, overrides default pathname matching for active nav state. */
  match?: (pathname: string) => boolean;
  /**
   * Oculta la ruta de la fila secundaria de DashboardNav sin sacarla del
   * registry: URL directa, permisos y PermissionMatrix siguen funcionando.
   */
  hiddenInNav?: boolean;
  /**
   * La ruta nace DENEGADA para todo el mundo y se concede a mano desde
   * /dashboard/admin/usuarios.
   *
   * El modelo de permisos del portal es una denylist: sin esto, una ruta nueva
   * la ve por defecto todo el que tenga la zona. Corporativas pudo resolverlo
   * siendo una zona que nadie tenía concedida, pero una página sensible dentro
   * de una zona ya repartida no tiene esa salida.
   *
   * La migración que introduce la ruta siembra las denegaciones de los usuarios
   * que ya existen; esta marca es la que cubre a los que se creen DESPUÉS
   * (`createAdminUserAction`).
   */
  deniedByDefault?: boolean;
}

export interface ModuleAction {
  key: string;
  label: string;
}

export interface ModuleDefinition {
  /** Stable slug — never rename after release. */
  key: string;
  label: string;
  icon: string;
  /** Prefix used to highlight the module tab (e.g. `/dashboard/portfolio`). */
  pathPrefix: string;
  /** Landing path when selecting this module in primary nav. */
  defaultPath: string;
  routes: ModuleRoute[];
  actions: ModuleAction[];
}

export interface PlatformNavSection {
  key: string;
  label: string;
  pathPrefix: string;
  defaultPath: string;
  routes: ModuleRoute[];
}
