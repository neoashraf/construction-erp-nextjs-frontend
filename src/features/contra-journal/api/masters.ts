import { apiClient } from "@/lib/api";

/**
 * MAS picker options for the GEN voucher editors. `AccountOption` mirrors the payment
 * shape (contract 01 `/masters/accounts` — some payloads use `accountType`, we normalize
 * to `type`). The contra editor filters to `isBankCash` (from MAS's `is_cash_bank` flag
 * or CoA group — the server backstops with `NOT_BANK_CASH_ACCOUNT` regardless).
 */
export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  isActive: boolean;
  isBankCash?: boolean;
}

export async function listAccountOptions(): Promise<AccountOption[]> {
  const res = await apiClient.get<{
    data: Array<{
      id: string;
      code: string;
      name: string;
      type?: string;
      accountType?: string;
      isActive: boolean;
      isBankCash?: boolean;
      isCashBank?: boolean;
    }>;
  }>("/masters/accounts");
  return res.data.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: normalize(a.type ?? a.accountType),
    isActive: a.isActive,
    isBankCash: a.isBankCash ?? a.isCashBank ?? false,
  }));
}

function normalize(t: string | undefined): AccountOption["type"] {
  if (t === "REVENUE") return "INCOME";
  if (t === "ASSET" || t === "LIABILITY" || t === "EQUITY" || t === "INCOME" || t === "EXPENSE") return t;
  return "ASSET";
}

/**
 * Bank/cash-account subset for the contra editor's account picker (FR-GEN-003 filter,
 * server-enforced regardless). MAS `is_cash_bank` classification is PENDING (SRS §16);
 * until then we heuristic on account code prefixes (`10xx` cash / `12xx` bank) to
 * surface a useful list, and always retain any account already on the loaded voucher
 * for the "(inactive/reclassified — replace before posting)" partial state.
 */
export function isBankOrCashAccount(a: AccountOption): boolean {
  if (a.isBankCash) return true;
  if (a.type !== "ASSET") return false;
  const code = String(a.code);
  return code.startsWith("10") || code.startsWith("11") || code.startsWith("12");
}

/**
 * Classify an account for the FE-50 journal cluster (spec §7 decision table):
 * P&L (INCOME/EXPENSE) needs project+cost_centre+purpose; AR/AP control needs party;
 * anything else (balance-sheet non-control) collects no cluster. The server enforces
 * via MISSING_REQUIRED_DIMENSION / MISSING_CONTROL_PARTY regardless.
 */
export type AccountClassification = "PL" | "CONTROL" | "OTHER_BS";

export function classifyAccount(a: AccountOption | undefined): AccountClassification {
  if (!a) return "OTHER_BS";
  if (a.type === "INCOME" || a.type === "EXPENSE") return "PL";
  const code = String(a.code);
  // AR (1200-series) or AP (2100-series) → control (backend classification is the
  // authority; this heuristic keeps the cluster right in the common case).
  if (code.startsWith("1200") || code.startsWith("2100")) return "CONTROL";
  return "OTHER_BS";
}

// ── Additional MAS pickers for the journal editor (thin bindings, skill §2.4). ──

export interface ProjectOption {
  id: string;
  name: string;
  projectCode?: string;
  status?: string;
}
export interface CostCentreOption {
  id: string;
  name: string;
}
export interface PurposeOption {
  id: string;
  name: string;
}
export interface PartyOption {
  id: string;
  name: string;
  isActive: boolean;
}

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>(
    "/masters/projects?page=1&pageSize=500",
  );
  return res.data;
}

export async function listCostCentreOptions(): Promise<CostCentreOption[]> {
  const res = await apiClient.get<{ data: CostCentreOption[] }>(
    "/masters/cost-centres?page=1&pageSize=500",
  );
  return res.data;
}

export async function listPurposeOptions(projectId: string): Promise<PurposeOption[]> {
  if (!projectId) return [];
  const res = await apiClient.get<{ data: PurposeOption[] }>(
    `/masters/projects/${projectId}/purposes?page=1&pageSize=500`,
  );
  return res.data;
}

export async function listPartyOptions(): Promise<PartyOption[]> {
  const res = await apiClient.get<{
    data: Array<{ id: string; name: string; isActive?: boolean }>;
  }>("/masters/parties?page=1&pageSize=500");
  return res.data.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive ?? true }));
}
