import { apiClient } from "@/lib/api";
import { type AccountOption, type PartyOption, type ProjectOption } from "../types";

/**
 * Read-only picker options for the Payment list filter bar. Thin local bindings to
 * MAS lookups (skill §2.4 import boundary — PAY owns these rather than importing
 * `features/master-data`, mirroring the PUR/SAL/REC precedent). Company implicit
 * from the JWT.
 */

export async function listProjectOptions(): Promise<ProjectOption[]> {
  const res = await apiClient.get<{ data: ProjectOption[] }>(
    "/masters/projects?page=1&pageSize=500",
  );
  return res.data;
}

export async function listPartyOptions(): Promise<PartyOption[]> {
  const res = await apiClient.get<{
    data: Array<{ id: string; name: string; isActive?: boolean }>;
  }>("/masters/parties?page=1&pageSize=500");
  return res.data.map((p) => ({ id: p.id, name: p.name, isActive: p.isActive ?? true }));
}

export async function listAccountOptions(): Promise<AccountOption[]> {
  const res = await apiClient.get<{
    data: Array<{ id: string; code: string; name: string; type?: string; accountType?: string; isActive: boolean }>;
  }>("/masters/accounts");
  return res.data.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: normalizeType(a.type ?? a.accountType),
    isActive: a.isActive,
  }));
}

function normalizeType(t: string | undefined): AccountOption["type"] {
  if (t === "REVENUE") return "INCOME";
  if (t === "ASSET" || t === "LIABILITY" || t === "EQUITY" || t === "INCOME" || t === "EXPENSE") return t;
  return "ASSET";
}
