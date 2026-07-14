import Decimal from "decimal.js";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type ContraVoucher } from "../types";
import { type ContraLineInput, type ContraWriteInput } from "../api/contra";

/**
 * Contra editor form + validate + error mapping (spec §7/§8; FR-GEN-001…-018). Every
 * line carries exactly one of debit/credit; ≥ 2 lines; accounts must be bank/cash
 * (server-enforced backstop). Money is Decimal(18,4) throughout (decimal.js, never JS
 * float). Every module error code maps to its exact spec §8 copy via `mapContraError`.
 */

const DECIMAL = /^\d*\.?\d*$/;

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

export interface ContraLineValues {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  narration: string;
}

export interface ContraFormValues {
  voucherDate: string; // DD/MM/YYYY
  narration: string;
  lines: ContraLineValues[];
}

export function emptyContraForm(): ContraFormValues {
  const today = new Date();
  const dd = String(today.getUTCDate()).padStart(2, "0");
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = today.getUTCFullYear();
  return {
    voucherDate: `${dd}/${mm}/${yyyy}`,
    narration: "",
    lines: [
      { key: "l1", accountId: "", debit: "", credit: "", narration: "" },
      { key: "l2", accountId: "", debit: "", credit: "", narration: "" },
    ],
  };
}

export type LineErrors = Partial<Record<keyof ContraLineValues, string>>;
export interface ContraErrors {
  voucherDate?: string;
  banner?: string;
  lines?: Record<string, LineErrors>;
}

export function totals(lines: ContraLineValues[]): { debit: string; credit: string; balanced: boolean; diff: string } {
  const d = lines.reduce((s, l) => s.plus(dec(l.debit)), new Decimal(0));
  const c = lines.reduce((s, l) => s.plus(dec(l.credit)), new Decimal(0));
  const diff = d.minus(c).abs();
  return {
    debit: d.toFixed(4),
    credit: c.toFixed(4),
    balanced: d.equals(c) && d.greaterThan(0),
    diff: diff.toFixed(4),
  };
}

interface AccountLookup {
  isBankCash: (id: string) => boolean;
}

export function validateContra(form: ContraFormValues, lookup: AccountLookup): {
  values: ContraFormValues;
  errors: null;
} | {
  values: null;
  errors: ContraErrors;
} {
  const errors: ContraErrors = { lines: {} };

  if (!form.voucherDate.trim()) errors.voucherDate = "Enter a voucher date.";
  else {
    try {
      parseDate(form.voucherDate);
    } catch {
      errors.voucherDate = "Enter a valid date (DD/MM/YYYY).";
    }
  }

  if (form.lines.length < 2) {
    errors.banner = "Contra vouchers need at least two lines.";
  }

  for (const line of form.lines) {
    const le: LineErrors = {};
    if (!line.accountId) le.accountId = "Choose a bank or cash account.";
    else if (!lookup.isBankCash(line.accountId)) {
      le.accountId = "This account isn't bank/cash. Use a journal, payment, or receipt voucher instead.";
    }
    const hasDr = line.debit.trim() !== "" && dec(line.debit).greaterThan(0);
    const hasCr = line.credit.trim() !== "" && dec(line.credit).greaterThan(0);
    if (line.debit && !DECIMAL.test(line.debit)) le.debit = "Enter a valid amount.";
    else if (dec(line.debit).isNegative()) le.debit = "Amount can't be negative.";
    if (line.credit && !DECIMAL.test(line.credit)) le.credit = "Enter a valid amount.";
    else if (dec(line.credit).isNegative()) le.credit = "Amount can't be negative.";
    if (hasDr && hasCr) le.debit = "A line can carry either a debit or a credit — not both.";
    if (!hasDr && !hasCr) le.debit = "Enter a debit or a credit amount greater than zero.";
    if (Object.keys(le).length > 0) errors.lines![line.key] = le;
  }

  if (Object.keys(errors.lines ?? {}).length === 0) delete errors.lines;
  if (errors.voucherDate || errors.banner || errors.lines) {
    return { values: null, errors };
  }
  return { values: form, errors: null };
}

export function isPostable(form: ContraFormValues, lookup: AccountLookup): boolean {
  if (validateContra(form, lookup).errors !== null) return false;
  return totals(form.lines).balanced;
}

function uiDateToApi(v: string): string {
  const d = parseDate(v);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function apiDateToUi(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function formToWriteInput(v: ContraFormValues): ContraWriteInput {
  const lines: ContraLineInput[] = v.lines.map((l) => {
    const hasDr = l.debit.trim() !== "" && dec(l.debit).greaterThan(0);
    return {
      accountId: l.accountId,
      debit: hasDr ? dec(l.debit).toFixed(4) : "0.0000",
      credit: !hasDr ? dec(l.credit).toFixed(4) : "0.0000",
      narration: l.narration.trim() || null,
    };
  });
  return {
    voucherDate: uiDateToApi(v.voucherDate),
    narration: v.narration.trim() || null,
    lines,
  };
}

export function contraToForm(v: ContraVoucher): ContraFormValues {
  return {
    voucherDate: apiDateToUi(v.voucherDate),
    narration: v.narration ?? "",
    lines: v.lines.map((l, i) => ({
      key: `existing-${i}`,
      accountId: l.accountId,
      debit: dec(l.debit).greaterThan(0) ? dec(l.debit).toFixed(4) : "",
      credit: dec(l.credit).greaterThan(0) ? dec(l.credit).toFixed(4) : "",
      narration: l.narration ?? "",
    })),
  };
}

export function mapContraError(code: string, ctx?: { diff?: string }): string {
  switch (code) {
    case "NOT_BANK_CASH_ACCOUNT":
      return "One or more accounts aren't bank/cash. Use a journal, payment, or receipt voucher instead.";
    case "UNBALANCED_ENTRY":
      return ctx?.diff
        ? `The voucher is out of balance by ৳${ctx.diff}. Fix the amounts and try again.`
        : "The voucher isn't balanced. Fix the amounts and try again.";
    case "VOUCHER_POSTED_IMMUTABLE":
      return "This voucher has been posted and can no longer be edited or deleted.";
    case "VOUCHER_NOT_POSTED":
      return "This voucher isn't posted, so it can't be reversed.";
    case "ALREADY_REVERSED":
      return "This voucher has already been reversed.";
    case "PERIOD_CLOSED":
      return "This period is closed. Choose a date in an open period or contact Admin.";
    case "NO_PERIOD_DEFINED":
      return "No accounting period is defined for this date. Define one before posting.";
    case "PROJECT_CLOSED":
      return "This project is closed and can't accept new postings.";
    case "OPTIMISTIC_LOCK_CONFLICT":
      return "This voucher was changed by someone else. Reload the latest version and try again.";
    case "CROSS_COMPANY_REFERENCE":
      return "One or more accounts belong to another company.";
    case "VALIDATION_ERROR":
      return "Couldn't save this voucher. Please check the highlighted fields.";
    case "FORBIDDEN":
      return "You don't have permission to perform this action.";
    default:
      return "Something went wrong. Please try again.";
  }
}
