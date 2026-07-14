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
