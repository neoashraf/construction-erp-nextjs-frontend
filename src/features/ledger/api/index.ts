/**
 * Ledger (LED) — module API bindings (skill §2.1/§3). Thin named wrappers over the
 * configured `apiClient`. Read-only surface (the ledger has no HTTP write).
 *
 * Import boundary: features import `@/lib/api`, never `@/lib/api/generated/*`.
 */
export * from "./entries";
export * from "./lines";
export * from "./trial-balance";
