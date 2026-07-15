import { apiClient } from "@/lib/api";

/**
 * Thin local binding to the FY list (API contract 01 § Financial Years) so the
 * profile screen can resolve `financialYearId` → label without importing across
 * feature boundaries. Company is implicit from the JWT.
 */

interface FinancialYearWire {
  id: string;
  label: string;
}

export interface FinancialYearLabel {
  id: string;
  label: string;
}

export async function listFinancialYearLabels(): Promise<FinancialYearLabel[]> {
  const res = await apiClient.get<{ data: FinancialYearWire[] }>("/masters/financial-years");
  return res.data.map((fy) => ({ id: fy.id, label: fy.label }));
}
