export interface ModuleRoute {
  key: string;
  path: string;
  label: string;
  /** When set, overrides default pathname matching for active nav state. */
  match?: (pathname: string) => boolean;
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
