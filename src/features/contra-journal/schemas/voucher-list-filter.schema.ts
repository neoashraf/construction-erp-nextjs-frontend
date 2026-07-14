import { parseDate } from "@/lib/format";
import { type VoucherStatus } from "../types";

/**
 * Voucher list filter state + client-side validation (spec §7). The `type` chip drives
 * the underlying endpoint(s); status/date/entry number/account/party/project are
 * AND-combined server-side query params. `dateFrom > dateTo` is the one pre-request
 * validation surfaced with an exact inline message.
 */

export type VoucherTypeFilter = "ALL" | "CONTRA" | "JOURNAL" | "OPENING";

export interface VoucherFilterValues {
  type: VoucherTypeFilter;
  status: VoucherStatus[]; // multi
  dateFrom: string; // DD/MM/YYYY
  dateTo: string;
  entryNo: string;
  accountId: string;
  partyId: string;
  projectId: string;
}

export const EMPTY_VOUCHER_FILTER: VoucherFilterValues = {
  type: "ALL",
  status: [],
  dateFrom: "",
  dateTo: "",
  entryNo: "",
  accountId: "",
  partyId: "",
  projectId: "",
};

export function validateDateRange(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) return null;
  try {
    if (parseDate(dateFrom).getTime() > parseDate(dateTo).getTime()) {
      return "Date from cannot be after date to.";
    }
  } catch {
    /* per-field format errors are handled by the picker */
  }
  return null;
}

export function isFiltered(f: VoucherFilterValues): boolean {
  return !!(
    f.type !== "ALL" ||
    f.status.length > 0 ||
    f.dateFrom ||
    f.dateTo ||
    f.entryNo ||
    f.accountId ||
    f.partyId ||
    f.projectId
  );
}
