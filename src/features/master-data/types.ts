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

/** A project status (FR-MAS-005/006). */
export type ProjectStatus = "PLANNED" | "ACTIVE" | "ON_HOLD" | "CLOSED";

/**
 * A project (FR-MAS-005; API `GET …/projects`). Only the fields the master screens
 * need are modelled here; per-screen briefs extend as required.
 */
export interface Project {
  id: string;
  projectCode: string;
  name: string;
  status: ProjectStatus;
  location: string | null;
  customerId: string | null;
  projectManagerId: string | null;
  startDate: string;
  expectedEndDate: string;
  actualEndDate: string | null;
  isActive: boolean;
  version: number;
}

/**
 * A project-scoped purpose — the fourth posting dimension (FR-MAS-011/012/013; API
 * `GET …/projects/:projectId/purposes`). Case-insensitive unique per project.
 */
export interface Purpose {
  id: string;
  projectId: string;
  name: string;
  isActive: boolean;
  version: number;
}

/**
 * A company-global cost centre (FR-MAS-009/010; API `GET …/cost-centres`). One of
 * the four posting dimensions. `version` drives concurrency (FR-MAS-032).
 */
export interface CostCentre {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  version: number;
}

/** The five account classifications (FR-MAS-006/017/018). */
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";

export const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

/** An account group node (FR-MAS-017; API `GET …/account-groups`). Nestable by parentGroupId. */
export interface AccountGroup {
  id: string;
  name: string;
  parentGroupId: string | null;
  type: AccountType;
  version: number;
}

/**
 * A posting account (FR-MAS-018/019/020/021; API `GET …/accounts/:id`). `type` equals
 * its group's type; immutable once it has postings. `openingBalance` is Decimal(18,4)
 * reference data. `hasPostings` (when the API supplies it) disables the type/group edit.
 */
export interface Account {
  id: string;
  code: string;
  name: string;
  accountGroupId: string;
  type: AccountType;
  openingBalance: string | null;
  isActive: boolean;
  version: number;
  hasPostings?: boolean;
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
