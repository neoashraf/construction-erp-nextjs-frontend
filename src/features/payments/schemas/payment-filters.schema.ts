import { parseDate } from "@/lib/format";
import { type PayableType, type PaymentMode, type PaymentStatus } from "../types";

/**
 * Filter-bar state schemas + client-side validation (spec §7). The list filter is
 * AND-combined on the server (contract 13 `GET /api/payment`); the outstanding
 * filter is a small subset (party + payable type). `dateFrom > dateTo` is the only
 * pre-request validation surfaced with an exact inline message.
 */

export interface PaymentFilterValues {
  entryNo: string;
  partyId: string;
  paymentAccountId: string;
  payableType: "" | PayableType;
  status: PaymentStatus[];
  paymentMode: PaymentMode[];
  dateFrom: string; // DD/MM/YYYY
  dateTo: string;
}

export const EMPTY_PAYMENT_FILTER: PaymentFilterValues = {
  entryNo: "",
  partyId: "",
  paymentAccountId: "",
  payableType: "",
  status: [],
  paymentMode: [],
  dateFrom: "",
  dateTo: "",
};

export interface OutstandingFilterValues {
  partyId: string;
  payableType: "" | PayableType;
}

export const EMPTY_OUTSTANDING_FILTER: OutstandingFilterValues = {
  partyId: "",
  payableType: "",
};

export interface FilterError {
  field: "dateFrom" | "dateTo";
  message: string;
}

export function validateDateRange(
  dateFrom: string,
  dateTo: string,
): FilterError | null {
  if (!dateFrom || !dateTo) return null;
  try {
    if (parseDate(dateFrom).getTime() > parseDate(dateTo).getTime()) {
      return { field: "dateTo", message: "Date from cannot be after date to." };
    }
  } catch {
    // date-format errors are per-field, handled at the DatePickerInput level.
  }
  return null;
}

export function isFiltered(f: PaymentFilterValues): boolean {
  return !!(
    f.entryNo ||
    f.partyId ||
    f.paymentAccountId ||
    f.payableType ||
    f.status.length > 0 ||
    f.paymentMode.length > 0 ||
    f.dateFrom ||
    f.dateTo
  );
}
