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

/**
 * A party — customer and/or supplier (FR-MAS-022/023/024; API `GET …/parties/:id`).
 * One record may hold both roles. `openingBalance` is a Decimal(18,4) string (GEN
 * opening journal); `phone` is E.164. `version` drives concurrency (FR-MAS-032).
 */
export interface Party {
  id: string;
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  tin: string | null;
  bin: string | null;
  address: string | null;
  phone: string;
  email: string | null;
  paymentTermsDays: number | null;
  openingBalance: string | null;
  isActive: boolean;
  version: number;
}
