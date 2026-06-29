/**
 * Public surface of the API layer. Features import from here (and their own
 * module `api/` binding) — never from `./generated` directly (import-boundary rule).
 */
export { apiClient, request, BFF_BASE_PATH, CSRF_HEADER } from "./client";
export type { ApiClient, RequestOptions } from "./client";
export { ApiError, toApiError, asApiError, networkError } from "./errors";
export type { ApiErrorCode, ApiErrorShape } from "./errors";
export { DEFAULT_PAGE_SIZE, pageQuery, pageCount } from "./pagination";
export type { Paginated, PageParams } from "./pagination";
export type { components, paths, operations } from "./generated/schema";
