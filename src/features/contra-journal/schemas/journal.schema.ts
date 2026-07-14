import Decimal from "decimal.js";
import { parseDate } from "@/lib/format";
import { toDecimal } from "@/lib/money";
import { type JournalVoucher } from "../types";
import { type JournalLineInput, type JournalWriteInput } from "../api/journal";
import { classifyAccount, type AccountOption } from "../api/masters";

/**
 * Journal editor form + conditional-tag validation + error mapping (spec §7/§8;
 * FR-GEN-004…-018). Each line requires either a debit or a credit (mutually
 * exclusive) and the account-driven cluster: P&L → project+cost_centre+purpose;
 * AR/AP control → party; other balance-sheet → none. Money is Decimal(18,4)
 * throughout; the authoritative balance + tag-matrix check is the server's — the
 * client pre-flights and disables Post.
 */

const DECIMAL = /^\d*\.?\d*$/;

function dec(v: string): Decimal {
  try {
    return toDecimal(v.trim() === "" ? "0" : v);
  } catch {
    return new Decimal(0);
  }
}

export interface JournalLineValues {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  projectId: string;
  costCentreId: string;
  purposeId: string;
  partyId: string;
  narration: string;
}

export interface JournalFormValues {
  voucherDate: string;
  narration: string;
  lines: JournalLineValues[];
}

export function emptyJournalForm(): JournalFormValues {
  const today = new Date();
  const dd = String(today.getUTCDate()).padStart(2, "0");
  const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = today.getUTCFullYear();
  return {
    voucherDate: `${dd}/${mm}/${yyyy}`,
    narration: "",
    lines: [
      { key: "l1", accountId: "", debit: "", credit: "", projectId: "", costCentreId: "", purposeId: "", partyId: "", narration: "" },
      { key: "l2", accountId: "", debit: "", credit: "", projectId: "", costCentreId: "", purposeId: "", partyId: "", narration: "" },
    ],
  };
}

export type JournalLineErrors = Partial<Record<keyof JournalLineValues, string>>;
export interface JournalErrors {
  voucherDate?: string;
  banner?: string;
  lines?: Record<string, JournalLineErrors>;
}

export function totals(lines: JournalLineValues[]): { debit: string; credit: string; balanced: boolean; diff: string } {
  const d = lines.reduce((s, l) => s.plus(dec(l.debit)), new Decimal(0));
  const c = lines.reduce((s, l) => s.plus(dec(l.credit)), new Decimal(0));
  const diff = d.minus(c).abs();
  return { debit: d.toFixed(4), credit: c.toFixed(4), balanced: d.equals(c) && d.greaterThan(0), diff: diff.toFixed(4) };
}

export function validateJournal(
  form: JournalFormValues,
  accountsIndex: Map<string, AccountOption>,
): { values: JournalFormValues; errors: null } | { values: null; errors: JournalErrors } {
  const errors: JournalErrors = { lines: {} };

  if (!form.voucherDate.trim()) errors.voucherDate = "Enter a voucher date.";
  else {
    try {
      parseDate(form.voucherDate);
    } catch {
      errors.voucherDate = "Enter a valid date (DD/MM/YYYY).";
    }
  }
  if (form.lines.length < 2) errors.banner = "Journal vouchers need at least two lines.";

  for (const line of form.lines) {
    const le: JournalLineErrors = {};
    if (!line.accountId) le.accountId = "Choose an account.";
    const hasDr = line.debit.trim() !== "" && dec(line.debit).greaterThan(0);
    const hasCr = line.credit.trim() !== "" && dec(line.credit).greaterThan(0);
    if (line.debit && !DECIMAL.test(line.debit)) le.debit = "Enter a valid amount.";
    else if (dec(line.debit).isNegative()) le.debit = "Amount can't be negative.";
    if (line.credit && !DECIMAL.test(line.credit)) le.credit = "Enter a valid amount.";
    else if (dec(line.credit).isNegative()) le.credit = "Amount can't be negative.";
    if (hasDr && hasCr) le.debit = "A line can carry either a debit or a credit — not both.";
    if (!hasDr && !hasCr) le.debit = "Enter a debit or a credit amount greater than zero.";

    // Conditional cluster requirements — key on the account classification.
    if (line.accountId) {
      const cls = classifyAccount(accountsIndex.get(line.accountId));
      if (cls === "PL") {
        if (!line.projectId) le.projectId = "Choose a project.";
        if (!line.costCentreId) le.costCentreId = "Choose a cost centre.";
        if (!line.purposeId) le.purposeId = "Choose a purpose.";
      } else if (cls === "CONTROL") {
        if (!line.partyId) le.partyId = "Choose a party for this control account.";
      }
    }

    if (Object.keys(le).length > 0) errors.lines![line.key] = le;
  }

  if (Object.keys(errors.lines ?? {}).length === 0) delete errors.lines;
  if (errors.voucherDate || errors.banner || errors.lines) return { values: null, errors };
  return { values: form, errors: null };
}

export function isPostable(form: JournalFormValues, accountsIndex: Map<string, AccountOption>): boolean {
  if (validateJournal(form, accountsIndex).errors !== null) return false;
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

export function formToWriteInput(v: JournalFormValues, accountsIndex: Map<string, AccountOption>): JournalWriteInput {
  const lines: JournalLineInput[] = v.lines.map((l) => {
    const hasDr = l.debit.trim() !== "" && dec(l.debit).greaterThan(0);
    const cls = classifyAccount(accountsIndex.get(l.accountId));
    return {
      accountId: l.accountId,
      debit: hasDr ? dec(l.debit).toFixed(4) : "0.0000",
      credit: !hasDr ? dec(l.credit).toFixed(4) : "0.0000",
      projectId: cls === "PL" ? l.projectId || null : null,
      costCentreId: cls === "PL" ? l.costCentreId || null : null,
      purposeId: cls === "PL" ? l.purposeId || null : null,
      partyId: cls === "CONTROL" ? l.partyId || null : null,
      narration: l.narration.trim() || null,
    };
  });
  return {
    voucherDate: uiDateToApi(v.voucherDate),
    narration: v.narration.trim() || null,
    lines,
  };
}

export function journalToForm(v: JournalVoucher): JournalFormValues {
  return {
    voucherDate: apiDateToUi(v.voucherDate),
    narration: v.narration ?? "",
    lines: v.lines.map((l, i) => ({
      key: `existing-${i}`,
      accountId: l.accountId,
      debit: dec(l.debit).greaterThan(0) ? dec(l.debit).toFixed(4) : "",
      credit: dec(l.credit).greaterThan(0) ? dec(l.credit).toFixed(4) : "",
      projectId: l.projectId ?? "",
      costCentreId: l.costCentreId ?? "",
      purposeId: l.purposeId ?? "",
      partyId: l.partyId ?? "",
      narration: l.narration ?? "",
    })),
  };
}

/** Clear the now-inapplicable cluster fields when an account changes on a line. */
export function clearClusterOnAccountChange(
  prev: JournalLineValues,
  accountsIndex: Map<string, AccountOption>,
): JournalLineValues {
  const cls = classifyAccount(accountsIndex.get(prev.accountId));
  if (cls === "PL") return { ...prev, partyId: "" };
  if (cls === "CONTROL") return { ...prev, projectId: "", costCentreId: "", purposeId: "" };
  return { ...prev, projectId: "", costCentreId: "", purposeId: "", partyId: "" };
}

export function mapJournalError(code: string, ctx?: { diff?: string }): string {
  switch (code) {
    case "MISSING_REQUIRED_DIMENSION":
      return "A required posting dimension (project, cost centre, or purpose) is missing on a P&L line.";
    case "MISSING_CONTROL_PARTY":
      return "A control account is missing its party. Add the party and try again.";
    case "CROSS_PROJECT_DIMENSION":
      return "The purpose doesn't belong to the chosen project.";
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
