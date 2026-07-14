import { apiClient } from "@/lib/api";
import {
  type AccountOption,
  type CostCentreOption,
  type CustomerOption,
  type ProjectOption,
  type PurposeOption,
} from "../types";

/**
 * Read-only picker options for the Receipt list filter bar + editor. Thin local
 * bindings to the MAS list endpoints (nextjs-author skill §2.4 import boundary — REC
 * owns these rather than importing `features/master-data`, mirroring the PUR/SAL
 * precedent). Company implicit from the JWT; the server scopes a project-scoped
 * reader (PM) to assigned projects regardless of what this picker shows. Customers
 * come from the shared Parties list filtered by `isCustomer=true`.
 */

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>(
    "/masters/projects?page=1&pageSize=500",
  );
  return res.data;
}

export async function listCustomerOptions(): Promise<CustomerOption[]> {
  const res = await apiClient.get<{
    data: Array<{ id: string; name: string; isActive?: boolean }>;
  }>("/masters/parties?isCustomer=true&page=1&pageSize=500");
  return res.data.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive ?? true }));
}

/**
 * All accounts (COA leaves). The editor uses this to pull two subsets client-side:
 * bank/cash/MFS deposit accounts (ASSETs matching the receipt-deposit pattern) and
 * general-target accounts (INCOME + advance-from-customer LIABILITY). The server
 * remains authoritative — `400 INVALID_GENERAL_TARGET` backstops a wrong target.
 *
 * The MAS payload uses `accountType` while the FE view-model prefers `type`; normalize
 * here so screens don't fork on the wire vs. UI naming.
 */
export async function listAccountOptions(): Promise<AccountOption[]> {
  const res = await apiClient.get<{
    data: Array<{ id: string; code: string; name: string; type?: string; accountType?: string; isActive: boolean }>;
  }>("/masters/accounts");
  return res.data.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: normalizeAccountType(a.type ?? a.accountType),
    isActive: a.isActive,
  }));
}

function normalizeAccountType(t: string | undefined): AccountOption["type"] {
  if (t === "REVENUE") return "INCOME"; // MAS wire-name → FE type.
  if (
    t === "ASSET" ||
    t === "LIABILITY" ||
    t === "EQUITY" ||
    t === "INCOME" ||
    t === "EXPENSE"
  )
    return t;
  return "ASSET";
}

export async function listCostCentreOptions(): Promise<CostCentreOption[]> {
  const res = await apiClient.get<{ data: CostCentreOption[] }>(
    "/masters/cost-centres?page=1&pageSize=500",
  );
  return res.data;
}

/**
 * Project-scoped purpose list (MAS; FR-REC-007). For `projectId=""` returns an empty list
 * — a "General" receipt with no project has no purpose (spec §5B: null when General).
 */
export async function listPurposeOptions(projectId: string): Promise<PurposeOption[]> {
  if (!projectId) return [];
  const res = await apiClient.get<{ data: PurposeOption[] }>(
    `/masters/projects/${projectId}/purposes?page=1&pageSize=500`,
  );
  return res.data;
}
