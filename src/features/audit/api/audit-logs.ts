import { apiClient, BFF_BASE_PATH } from "@/lib/api";
import { ApiError, networkError, toApiError } from "@/lib/api/errors";
import { type Paginated } from "@/lib/api/pagination";
import {
  type AuditLogRow,
  type AuditLogDetail,
  type AuditLogFilter,
  type AuditExportFormat,
} from "../types";

/**
 * Audit-log API bindings (API contract 05 § Audit log, read-only — FR-AUD-020/021/
 * 022/024/026/027/028). There is NO create/edit/delete call — the log is append-only
 * (FR-AUD-023). `companyId` is implicit from the JWT — never sent as a param.
 *
 * The live `GET /api/audit-logs` list wraps its payload as `{ items, total }` (not
 * the platform's usual `{ data: T[], meta: { page, pageSize, total } }` — confirmed
 * against the merged backend controller/query-service; the documented contract is
 * stale on this point). This binding normalises that into the standard `Paginated<T>`
 * shape everywhere else in the app expects, using the `page`/`pageSize` WE requested
 * (the server doesn't echo them back).
 *
 * Import boundary: this feature imports `@/lib/api`, never `@/lib/api/generated/*`.
 */

const BASE = "/audit-logs";
const DEFAULT_PAGE_SIZE = 25;

function buildQuery(filter: AuditLogFilter): string {
  const p = new URLSearchParams();
  const set = (k: string, v: string | undefined) => {
    if (v !== undefined && v !== "") p.set(k, v);
  };
  set("entityType", filter.entityType);
  set("entityId", filter.entityId);
  set("userId", filter.userId);
  set("action", filter.action);
  set("projectId", filter.projectId);
  set("dateFrom", filter.dateFrom);
  set("dateTo", filter.dateTo);
  return p.toString();
}

/** List audit-log entries for the caller's company (server-scoped; FR-AUD-027). */
export async function listAuditLogs(filter: AuditLogFilter = {}): Promise<Paginated<AuditLogRow>> {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
  const qs = buildQuery(filter);
  const path = `${BASE}?${qs}${qs ? "&" : ""}page=${page}&pageSize=${pageSize}`;

  // The live endpoint's data payload is `{ items, total }`, wrapped in the
  // platform's generic `{ data, meta }` envelope (it is not a `Paginated`
  // instance server-side, so the interceptor doesn't lift page info into meta).
  const res = await apiClient.get<{
    data: { items: AuditLogRow[]; total: number } | AuditLogRow[];
    meta?: { page?: number; pageSize?: number; total?: number };
  }>(path);

  if (Array.isArray(res.data)) {
    // Tolerate the documented `{ data: T[], meta: {page,pageSize,total} }` shape too,
    // in case the backend contract is corrected later without a frontend change.
    const meta = res.meta ?? {};
    return {
      data: res.data,
      page: meta.page ?? page,
      pageSize: meta.pageSize ?? pageSize,
      total: meta.total ?? res.data.length,
    };
  }

  return {
    data: res.data.items,
    page,
    pageSize,
    total: res.data.total,
  };
}

/** Fetch one audit-log entry with its before/after diff + seal (FR-AUD-022/024). */
export async function getAuditLog(id: string): Promise<AuditLogDetail> {
  const res = await apiClient.get<{ data: AuditLogDetail }>(`${BASE}/${id}`);
  return res.data;
}

export interface AuditExportResult {
  blob: Blob;
  filename: string;
}

/**
 * Trigger the filtered export (FR-AUD-028). `GET /api/audit-logs/export` is a real
 * file download (`StreamableFile`, `Content-Disposition: attachment`) — NOT JSON —
 * so this bypasses the JSON-only `apiClient` and calls a dedicated BFF route
 * (`/api/audit-logs/export`, see `app/api/audit-logs/export/route.ts`) that streams
 * the upstream response body + headers through unmodified. No pagination params
 * (the full filtered set is exported server-side).
 */
export async function exportAuditLogs(
  filter: Omit<AuditLogFilter, "page" | "pageSize">,
  format: AuditExportFormat = "csv",
): Promise<AuditExportResult> {
  const qs = buildQuery(filter);
  const path = `${BFF_BASE_PATH}${BASE}/export?${qs}${qs ? "&" : ""}format=${format}`;

  let res: Response;
  try {
    res = await fetch(path, { credentials: "include" });
  } catch {
    throw networkError();
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body — toApiError falls back to statusText */
    }
    throw toApiError(body, res.status, res.statusText);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `audit-log.${format}`;
  return { blob, filename };
}

/** True when an ApiError represents "lacks AUD READ" (403) for the audit log. */
export function isAuditForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.code === "FORBIDDEN";
}
