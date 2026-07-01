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

/**
 * The single company record (FR-MAS-001/004; API `GET /api/masters/companies/:id`).
 * `version` drives optimistic concurrency on identity/localization saves (FR-MAS-032).
 */
export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  bin: string | null;
  tin: string | null;
  address: string | null;
  currency: string;
  dateFormat: string;
  locale: string;
  isActive: boolean;
  version: number;
}
