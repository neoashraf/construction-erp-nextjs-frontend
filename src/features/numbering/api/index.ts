/**
 * Voucher Numbering (NUM) — module API bindings (skill §2.1/§3). Thin named wrappers
 * over the configured `apiClient` (and the generated client via lib/api).
 *
 * Import boundary: features import `@/lib/api`, never `@/lib/api/generated/*`.
 */
export * from "./numbering-series";
