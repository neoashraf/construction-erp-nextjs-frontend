import { apiClient } from "@/lib/api";
import { type FinancialYearOption } from "../types";

/**
 * Financial-year options for the in-page FY selector (API contract 01 § Financial
 * Years, read-only here — MAS owns the entity). A thin local binding rather than
 * importing `features/master-data` (skill §2.4 import boundary). Company is
 * implicit from the JWT (NFR-005) — never sent as a client param.
 */

interface FinancialYearWire {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/** GET every financial year for the caller's company, mapped to selector options. */
export async function listFinancialYearOptions(): Promise<FinancialYearOption[]> {
  const res = await apiClient.get<{ data: FinancialYearWire[] }>("/masters/financial-years");
  return res.data.map((fy) => ({
    id: fy.id,
    label: fy.label,
    startDate: fy.startDate,
    endDate: fy.endDate,
    isActive: fy.isActive,
  }));
}
