import { apiClient } from "@/lib/api";
import { type FinancialYearOption } from "../types";

/**
 * Financial-year options for the user create/edit form's FY select (API contract
 * 01 § Financial Years, read-only here — MAS owns the entity). A thin local
 * binding rather than importing `features/master-data` (skill §2.4 import
 * boundary — features never reach into another feature's internals).
 */

interface FyWire {
  id: string;
  label: string;
}

interface Envelope<T> {
  data: T;
}

/** GET the company's financial years, mapped down to `{ id, label }` picker options. */
export async function listFinancialYearOptions(): Promise<FinancialYearOption[]> {
  const res = await apiClient.get<Envelope<FyWire[]>>("/masters/financial-years");
  return res.data.map((fy) => ({ id: fy.id, label: fy.label }));
}
