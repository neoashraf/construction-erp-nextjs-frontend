import { apiClient } from "@/lib/api/client";
import { networkError, toApiError } from "@/lib/api/errors";
import {
  type ReportDescriptor,
  type ReportFormat,
  type ReportParams,
  type ReportResult,
} from "../types";

/**
 * FE-54 shared RPT API — thin, typed bindings the six viewer briefs reuse.
 *   • `getReportCatalog()` — the role-filtered list of runnable reports.
 *   • `runReport(name, params)` — JSON result (envelope).
 *   • `exportReport(name, params, format)` — binary file download (Excel/PDF).
 * The mock backend responds with a canonical `TrialBalance`-shaped fixture for
 * `trial-balance`; other names return an empty-well-formed result until their
 * viewer brief lands.
 */

type Envelope<T> = { data: T };

function paramsToQuery(params: ReportParams, format?: ReportFormat): string {
  const search = new URLSearchParams();
  search.set("financialYearId", params.financialYearId);
  if (params.projectId) search.set("projectId", params.projectId);
  if (params.costCentreId) search.set("costCentreId", params.costCentreId);
  if (params.dateFrom) search.set("dateFrom", params.dateFrom);
  if (params.dateTo) search.set("dateTo", params.dateTo);
  if (params.asOf) search.set("asOf", params.asOf);
  if (params.periodId) search.set("periodId", params.periodId);
  if (params.extras) {
    for (const [key, value] of Object.entries(params.extras)) {
      if (value !== null && value !== undefined) search.set(key, String(value));
    }
  }
  if (format) search.set("format", format);
  const q = search.toString();
  return q ? `?${q}` : "";
}

export function getReportCatalog(): Promise<ReportDescriptor[]> {
  return apiClient
    .get<Envelope<ReportDescriptor[]>>("/reports/catalog")
    .then((r) => r.data);
}

export function runReport<Row = Record<string, unknown>>(
  name: string,
  params: ReportParams,
): Promise<ReportResult<Row>> {
  return apiClient
    .get<Envelope<ReportResult<Row>>>(`/reports/${name}${paramsToQuery(params, "json")}`)
    .then((r) => r.data);
}

/**
 * Binary download — returns a Blob + the server-supplied filename. The caller
 * clicks a synthetic `<a download>` link to save. Uses `fetch` directly since
 * `apiClient` assumes JSON responses.
 */
export interface ExportResult {
  blob: Blob;
  filename: string;
}

export async function exportReport(
  name: string,
  params: ReportParams,
  format: "excel" | "pdf",
): Promise<ExportResult> {
  const url = `/api/reports/${name}${paramsToQuery(params, format)}`;
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include", cache: "no-store" });
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    throw toApiError(body, res.status, res.statusText);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const filename = filenameFromDisposition(disposition) ?? defaultFilename(name, params, format);
  return { blob, filename };
}

/** Trigger the browser to save a blob. Falls back gracefully in SSR. */
export function saveBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function filenameFromDisposition(disposition: string): string | null {
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disposition);
  return match ? decodeURIComponent(match[1]!.trim()) : null;
}

function defaultFilename(name: string, params: ReportParams, format: "excel" | "pdf"): string {
  const scope = params.asOf ?? params.dateTo ?? params.dateFrom ?? "current";
  const ext = format === "excel" ? "xlsx" : "pdf";
  return `${name}-${scope}.${ext}`;
}
