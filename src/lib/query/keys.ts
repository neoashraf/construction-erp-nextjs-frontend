/**
 * Namespaced query-key conventions (skill §7). Keys are namespaced by module +
 * params, and include companyId/financialYearId where relevant so a tenant/FY
 * switch doesn't bleed cache across contexts. Per-screen briefs extend this.
 *
 * Shape: [module, resource, ...scopeAndParams]. Always an array (TanStack rule).
 */

export interface TenantScope {
  companyId: string;
  financialYearId: string;
}

export const queryKeys = {
  /** A whole module's cache subtree (for broad invalidation). */
  module: (module: string) => [module] as const,

  /** A resource list within a module, scoped to tenant/FY + arbitrary filters. */
  list: (module: string, resource: string, scope: TenantScope, params?: Record<string, unknown>) =>
    [module, resource, "list", scope.companyId, scope.financialYearId, params ?? {}] as const,

  /** A single resource by id within a module. */
  detail: (module: string, resource: string, id: string) => [module, resource, "detail", id] as const,

  /** The current session (independent of tenant/FY). */
  session: () => ["session"] as const,
};

export type QueryKeys = typeof queryKeys;
