import { apiClient } from "@/lib/api/client";
import { networkError, toApiError } from "@/lib/api/errors";
import {
  type ReportCategory,
  type ReportDescriptor,
  type ReportFormat,
  type ReportParamDescriptor,
  type ReportParams,
  type ReportResult,
  type ReportResultMeta,
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
  // Only send financialYearId when set. Some reports (e.g. attendance-summary) use
  // `month` instead and their backend DTO REJECTS an unknown financialYearId prop
  // (whitelist validation) — those viewers clear it out of the effective params.
  if (params.financialYearId) search.set("financialYearId", params.financialYearId);
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

/**
 * The NestJS backend returns the *domain* descriptor (`source`, `fr`,
 * `requiredPermission: {module, action}`, `parameters: string[]`, `asOf`) — a
 * pure shape that deliberately omits UI concerns like the catalog `category`,
 * the `viewerRoute`, and the one-line `description`. The mock BFF, by contrast,
 * already returns the enriched UI shape. `normalizeDescriptor` bridges both:
 * any field already present is kept; anything missing is enriched from the
 * per-report table below so the hub always has a `category` to group on and a
 * `viewerRoute` to navigate to. (Route/label/copy are frontend concerns and
 * stay out of the backend domain by design.)
 */
interface RawReportDescriptor {
  name: string;
  title: string;
  source?: string;
  parameters?: unknown;
  requiredPermission?: unknown;
  projectScoped?: boolean;
  asOf?: boolean;
  // Present when the response is already the enriched (mock BFF) shape:
  category?: ReportCategory;
  viewerRoute?: string;
  description?: string;
  supportsAsOf?: boolean;
  supportsDateRange?: boolean;
  projectRequired?: boolean;
}

interface CatalogUiMeta {
  category: ReportCategory;
  description: string;
  supportsAsOf?: boolean;
  supportsDateRange?: boolean;
  /** True only when the report cannot run without a specific project. */
  projectRequired?: boolean;
}

/** Per-report UI metadata, keyed by the backend catalog `name`. */
const REPORT_UI_META: Record<string, CatalogUiMeta> = {
  // Ledgers & registers
  "trial-balance": {
    category: "LEDGERS_REGISTERS",
    description: "Debit + credit balance per account for the period; must tie.",
    supportsAsOf: true,
    supportsDateRange: true,
  },
  "account-ledger": {
    category: "LEDGERS_REGISTERS",
    description: "Every posting to one account over a date range, with running balance.",
    supportsDateRange: true,
  },
  daybook: {
    category: "LEDGERS_REGISTERS",
    description: "All vouchers posted on each day over the period.",
    supportsDateRange: true,
  },
  "cash-bank-book": {
    category: "LEDGERS_REGISTERS",
    description: "Cash / bank account movements with running balance.",
    supportsDateRange: true,
  },
  // Financial statements
  "profit-and-loss": {
    category: "FINANCIAL_STATEMENTS",
    description: "Revenue vs cost of services + operating expenses for the period.",
    supportsDateRange: true,
  },
  "balance-sheet": {
    category: "FINANCIAL_STATEMENTS",
    description: "Assets = Liabilities + Equity as at a date.",
    supportsAsOf: true,
  },
  // Project & IPC
  "project-pnl": {
    category: "PROJECT_IPC",
    description: "Revenue vs cost per project; PM sees assigned only.",
    supportsDateRange: true,
    // Project P&L is per-project — the backend requires a projectId.
    projectRequired: true,
  },
  "ipc-billing": {
    category: "PROJECT_IPC",
    description: "Per-IPC certified / billed / received / outstanding + ageing.",
    supportsDateRange: true,
  },
  outstanding: {
    category: "PROJECT_IPC",
    description: "Per-IPC outstanding grouped by project, as-of a date.",
    supportsAsOf: true,
  },
  "material-consumption-vs-budget": {
    category: "PROJECT_IPC",
    description: "Consumed material cost vs cost-centre budget.",
    supportsDateRange: true,
  },
  "labour-cost": {
    category: "PROJECT_IPC",
    description: "Labour expense grouped by cost centre.",
    supportsDateRange: true,
  },
  // Inventory
  "stock-valuation": {
    category: "INVENTORY",
    description: "Qty on hand, value + weighted-avg rate per godown/item, as-of a date.",
    supportsAsOf: true,
  },
  "low-stock": {
    category: "INVENTORY",
    description: "Items at or below their re-order level.",
    supportsAsOf: true,
  },
  "stock-transfer-summary": {
    category: "INVENTORY",
    description: "Posted transfers / issues over a period, from → to godown.",
    supportsDateRange: true,
  },
  // Requisition & cost control
  "requisition-vs-issue": {
    category: "REQUISITION_COST_CONTROL",
    description: "Requested / issued / variance per requisition line.",
    supportsDateRange: true,
  },
  "cost-centre-variance": {
    category: "REQUISITION_COST_CONTROL",
    description: "Budgeted vs actual per cost centre + status.",
    supportsDateRange: true,
  },
  // HR
  "attendance-summary": {
    category: "HR",
    description: "Monthly present / leave / absent + head count per project.",
  },
  "salary-register": {
    category: "HR",
    description: "Salary sheet lines with earnings + deductions per employee.",
  },
  "employee-payment-history": {
    category: "HR",
    description: "Per-employee salary / payable settlements over a date range.",
    supportsDateRange: true,
  },
};

/** Fallback category from the backend `source` when a name isn't in the table. */
const SOURCE_TO_CATEGORY: Record<string, ReportCategory> = {
  LEDGER: "LEDGERS_REGISTERS",
  INVENTORY: "INVENTORY",
  HR: "HR",
  REQUISITION: "REQUISITION_COST_CONTROL",
  COST_CONTROL: "REQUISITION_COST_CONTROL",
  SALES_IPC: "PROJECT_IPC",
  PROJECT: "PROJECT_IPC",
};

/** The viewer route that owns each category (the hub navigates here on select). */
const CATEGORY_TO_VIEWER: Record<ReportCategory, string> = {
  LEDGERS_REGISTERS: "/reports/trial-balance-ledgers",
  FINANCIAL_STATEMENTS: "/reports/financial-statements",
  PROJECT_IPC: "/reports/project-ipc",
  INVENTORY: "/reports/inventory",
  REQUISITION_COST_CONTROL: "/reports/requisition-cost-control",
  HR: "/reports/hr",
};

/** Backend sends `parameters: string[]`; the panel needs descriptor objects. */
function normalizeParameters(raw: unknown): ReportParamDescriptor[] {
  if (!Array.isArray(raw)) return [];
  // Already the enriched (mock/object) shape → pass through; a bare string[]
  // carries no label/kind, so those params are handled natively by the panel
  // (FY/project/cost-centre/date/as-of) and surfaced as [] extras here.
  if (raw.every((p) => p !== null && typeof p === "object")) {
    return raw as ReportParamDescriptor[];
  }
  return [];
}

function normalizeDescriptor(raw: RawReportDescriptor): ReportDescriptor {
  const meta = REPORT_UI_META[raw.name];
  const category =
    raw.category ??
    meta?.category ??
    SOURCE_TO_CATEGORY[raw.source ?? ""] ??
    "LEDGERS_REGISTERS";
  return {
    name: raw.name,
    title: raw.title,
    description: raw.description ?? meta?.description ?? "",
    category,
    viewerRoute: raw.viewerRoute ?? CATEGORY_TO_VIEWER[category],
    // Domain sends {module, action}; every reports screen gates on `reports:READ`.
    requiredPermission:
      typeof raw.requiredPermission === "string" ? raw.requiredPermission : "reports",
    parameters: normalizeParameters(raw.parameters),
    projectScoped: raw.projectScoped ?? false,
    // `projectScoped` (nearly always true) means "supports a project filter"; only
    // `projectRequired` blocks Run. The backend never sends it, so it's meta-driven.
    projectRequired: raw.projectRequired ?? meta?.projectRequired ?? false,
    supportsAsOf: raw.supportsAsOf ?? meta?.supportsAsOf ?? raw.asOf ?? false,
    supportsDateRange: raw.supportsDateRange ?? meta?.supportsDateRange ?? false,
  };
}

export function getReportCatalog(): Promise<ReportDescriptor[]> {
  return apiClient
    .get<Envelope<RawReportDescriptor[]>>("/reports/catalog")
    .then((r) => r.data.map(normalizeDescriptor));
}

/**
 * Raw NestJS report envelope. `data` is EITHER the non-paginated result object
 * (trial-balance, P&L, …) OR — for paginated reports (daybook, account-ledger,
 * cash-bank-book, and the paginated inventory/HR/RCC reports) — the bare rows
 * array, with page info riding the outer `meta`.
 */
interface RawReportEnvelope<Row> {
  data:
    | (Partial<ReportResult<Row>> & {
        rows?: Row[];
        totals?: ReportResultMeta["totals"];
        generatedAt?: string;
      })
    | Row[];
  meta?: Record<string, unknown> & {
    page?: number;
    pageSize?: number;
    total?: number;
    generatedAt?: string;
    totals?: ReportResultMeta["totals"];
  };
}

export function runReport<Row = Record<string, unknown>>(
  name: string,
  params: ReportParams,
): Promise<ReportResult<Row>> {
  return apiClient
    .get<RawReportEnvelope<Row>>(`/reports/${name}${paramsToQuery(params, "json")}`)
    .then((env) => normalizeReportResult<Row>(name, params, env));
}

/**
 * Bridge the two NestJS report shapes to the single frontend `ReportResult` every
 * viewer reads (`.rows` + `.meta.{generatedAt,totals,page,…}`):
 *   • NON-paginated: `data` is the result object; `totals`/`generatedAt` sit at the
 *     TOP LEVEL of `data` (the real backend) — the outer `meta` is only `{requestId}`.
 *   • PAGINATED: `data` IS the rows array; `page`/`total` (and any opening-balance /
 *     date extras) ride the outer `meta`.
 * The mock BFF instead nests everything under `data.meta`; that path is handled too.
 * Without this, `.meta.generatedAt` throws the moment real data arrives.
 */
function normalizeReportResult<Row>(
  name: string,
  params: ReportParams,
  env: RawReportEnvelope<Row>,
): ReportResult<Row> {
  const envMeta = env.meta ?? {};
  const nowIso = new Date().toISOString();

  // Paginated: rows come back as the envelope `data` array.
  if (Array.isArray(env.data)) {
    const rows = env.data;
    const meta = {
      ...envMeta, // preserve openingBalance / dateFrom / dateTo when present
      page: envMeta.page ?? 1,
      pageSize: envMeta.pageSize ?? rows.length,
      total: envMeta.total ?? rows.length,
      generatedAt: envMeta.generatedAt ?? nowIso,
      totals: envMeta.totals ?? undefined,
    };
    return { reportName: name, parameters: params, rows, meta } as ReportResult<Row>;
  }

  // Non-paginated result object. Accept both top-level (real) and meta-nested (mock).
  const raw = env.data ?? {};
  const innerMeta = (raw as { meta?: Record<string, unknown> }).meta ?? {};
  const rows = raw.rows ?? [];
  const meta = {
    ...innerMeta,
    page: (innerMeta.page as number) ?? envMeta.page ?? 1,
    pageSize: (innerMeta.pageSize as number) ?? envMeta.pageSize ?? rows.length,
    total: (innerMeta.total as number) ?? envMeta.total ?? rows.length,
    generatedAt:
      (innerMeta.generatedAt as string) ?? raw.generatedAt ?? envMeta.generatedAt ?? nowIso,
    totals: (innerMeta.totals as ReportResultMeta["totals"]) ?? raw.totals ?? undefined,
  };
  return {
    reportName: raw.reportName ?? name,
    parameters: (raw.parameters as ReportParams) ?? params,
    rows,
    meta,
  } as ReportResult<Row>;
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
