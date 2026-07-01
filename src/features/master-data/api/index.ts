/**
 * Master Data (MAS) — module API bindings (skill §2.1/§3). Thin named wrappers over
 * the configured `apiClient` → the BFF. Import boundary: features import
 * `@/lib/api`, never `@/lib/api/generated/*`.
 */
export * from "./financial-years";
export * from "./company";
export * from "./parties";
export * from "./chart-of-accounts";
export * from "./cost-centres";
