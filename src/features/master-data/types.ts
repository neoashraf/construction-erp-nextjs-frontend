/**
 * View-model types for the Master Data (MAS) feature (skill §2.1). UI-facing types
 * (NOT the generated wire types in lib/api/generated). Per-screen briefs extend this.
 */

/**
 * A financial year (FR-MAS-002/003; API `GET /api/masters/financial-years`).
 * `startDate`/`endDate` are `YYYY-MM-DD` date-only strings from the API (rendered
 * `DD/MM/YYYY`). `version` drives optimistic concurrency on edit (FR-MAS-032).
 */
export interface FinancialYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  version: number;
}
