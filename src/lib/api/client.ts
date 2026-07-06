import { networkError, toApiError } from "./errors";
import { navigateToForcedChange } from "@/lib/auth/forced-change";
import { type Paginated } from "./pagination";

/**
 * The single configured API client (skill §3, ADR-0003 F6). It targets the **BFF
 * base** — the Next.js `/api/*` route handlers — NOT the NestJS host directly, so
 * the httpOnly-cookie/bearer bridge (§4) is always in the path. It:
 *  - sends credentials (cookies) with every request,
 *  - maps the §6 error envelope → a typed `ApiError`,
 *  - returns the `{ data, page, pageSize, total }` pagination shape typed.
 *
 * Generated per-endpoint functions live in `./generated`; per-module
 * `features/<module>/api/` wrap them into named calls. Only `lib/api/` imports
 * the generated client (import-boundary rule).
 */

/** Path prefix for the BFF route handlers (the browser only ever talks to these). */
export const BFF_BASE_PATH = "/api";

/** Header name for the CSRF double-submit token (state-changing requests). */
export const CSRF_HEADER = "x-csrf-token";

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON body — serialised automatically; sets Content-Type. */
  json?: unknown;
  /** CSRF token for state-changing requests (double-submit; §4). */
  csrfToken?: string;
}

/**
 * Resolve a request URL. In the browser, relative `/api/...` is fine. During SSR
 * there is no origin, so prefix with the app URL (public config) to make it absolute.
 */
function resolveUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const full = normalized.startsWith(BFF_BASE_PATH) ? normalized : `${BFF_BASE_PATH}${normalized}`;
  if (typeof window !== "undefined") return full;
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${origin}${full}`;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Core request. Resolves with the typed JSON body on 2xx; throws a typed
 * `ApiError` on a non-2xx (envelope-mapped) or a transport failure.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, csrfToken, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  if (json !== undefined) finalHeaders.set("content-type", "application/json");
  if (csrfToken) finalHeaders.set(CSRF_HEADER, csrfToken);

  let res: Response;
  try {
    res = await fetch(resolveUrl(path), {
      // Always include cookies — the BFF reads the httpOnly auth cookies.
      credentials: "include",
      ...rest,
      headers: finalHeaders,
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch {
    throw networkError();
  }

  if (res.status === 204) return undefined as T;

  const body = await parseBody(res);
  if (!res.ok) {
    const error = toApiError(body, res.status, res.statusText);
    // Forced-change gate (FR-AUD-030): while the user is on a temp/reset password
    // the backend 403s every data call with PASSWORD_CHANGE_REQUIRED — route them
    // to the forced change-password screen (browser only; SSR callers just throw).
    if (error.code === "PASSWORD_CHANGE_REQUIRED") {
      navigateToForcedChange();
    }
    throw error;
  }
  return body as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", json }),
  patch: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", json }),
  put: <T>(path: string, json?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", json }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
  /** Typed paginated GET — returns the `{ data, page, pageSize, total }` shape. */
  getPage: <T>(path: string, options?: RequestOptions) => request<Paginated<T>>(path, { ...options, method: "GET" }),
};

export type ApiClient = typeof apiClient;
