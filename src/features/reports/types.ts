/**
 * FE-54 shared RPT types (SRS §5.1/§5.2/§5.8, contract 15). Every report is a
 * SELECT + an export — no create/update/delete/post/reverse exists anywhere in
 * the module (FR-RPT-003). Per-report row shapes are added by the viewer briefs
 * (fe-financial-statements, fe-trial-balance-ledgers, …) — this file only
 * carries the shared envelope + the catalog descriptor.
 */

export type ReportFormat = "json" | "excel" | "pdf";

export type ReportParamKind =
  | "financialYear"
  | "project"
  | "costCentre"
  | "dateRange"
  | "asOf"
  | "period"
  // Report-specific filter slot values are opaque strings/booleans/etc.
  | "text"
  | "select"
  | "boolean";

export interface ReportParamDescriptor {
  key: string;
  kind: ReportParamKind;
  label: string;
  required?: boolean;
  /** For "select" kind — value/label options. */
  options?: { value: string; label: string }[];
  helper?: string;
}

/**
 * The catalog entry per report (returned by `GET /api/reports/catalog`). The
 * catalog is filtered server-side to what the caller may run (FR-RPT-008) — the
 * FE still hides forbidden entries defensively.
 */
export interface ReportDescriptor {
  /** Stable machine name; the run path is `/api/reports/<name>`. */
  name: string;
  /** Human-readable title (Bangla-safe). */
  title: string;
  /** One-line teaser rendered under the title. */
  description: string;
  /** Category slug — one of the SRS clusters. */
  category: ReportCategory;
  /** The viewer route this catalog entry navigates to. */
  viewerRoute: string;
  /** Resource-catalogue code the caller must hold `READ` on. */
  requiredPermission: string;
  /** Report-specific filter slot descriptors (rendered dynamically). */
  parameters: ReportParamDescriptor[];
  /**
   * True when the report is project-scoped: the panel shows the Project filter and
   * a PM is auto-scoped to assigned projects. This does NOT make the project
   * mandatory — nearly every backend report is project-scoped yet runs company-wide
   * ("All projects"). Use `projectRequired` for the mandatory case.
   */
  projectScoped?: boolean;
  /** True only when the report cannot run without a specific project (e.g. Project P&L). */
  projectRequired?: boolean;
  /** True when this report uses `asOf`/`periodId` rather than a date range. */
  supportsAsOf?: boolean;
  /** True when this report uses `dateFrom`/`dateTo`. */
  supportsDateRange?: boolean;
}

export type ReportCategory =
  | "FINANCIAL_STATEMENTS"
  | "LEDGERS_REGISTERS"
  | "PROJECT_IPC"
  | "INVENTORY"
  | "REQUISITION_COST_CONTROL"
  | "HR";

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  FINANCIAL_STATEMENTS: "Financial statements",
  LEDGERS_REGISTERS: "Ledgers & registers",
  PROJECT_IPC: "Project reports",
  INVENTORY: "Inventory reports",
  REQUISITION_COST_CONTROL: "Requisition & cost-control reports",
  HR: "HR reports",
};

export const REPORT_CATEGORY_ORDER: ReportCategory[] = [
  "LEDGERS_REGISTERS",
  "FINANCIAL_STATEMENTS",
  "PROJECT_IPC",
  "INVENTORY",
  "REQUISITION_COST_CONTROL",
  "HR",
];

export interface ReportParams {
  financialYearId: string;
  projectId?: string | null;
  costCentreId?: string | null;
  dateFrom?: string | null; // YYYY-MM-DD
  dateTo?: string | null; // YYYY-MM-DD
  asOf?: string | null; // YYYY-MM-DD
  periodId?: string | null;
  /** Any report-specific filters — keyed by `ReportParamDescriptor.key`. */
  extras?: Record<string, string | number | boolean | null>;
}

export interface ReportResultMeta {
  page: number;
  pageSize: number;
  total: number;
  /** ISO-8601 UTC — when the DB snapshot was rendered. */
  generatedAt: string;
  /** Any server-side totals the report ships (shape is per-report). */
  totals?: Record<string, string | number | null>;
}

export interface ReportResult<Row> {
  reportName: string;
  parameters: ReportParams;
  rows: Row[];
  meta: ReportResultMeta;
}
