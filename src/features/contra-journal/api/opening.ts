import { apiClient } from "@/lib/api";
import { readCsrfToken } from "@/lib/auth/csrf-client";
import { listJournalVouchers } from "./journal";
import { type JournalVoucher, type JournalVoucherSummary } from "../types";

/**
 * Opening Journal API bindings (API contract 14 § "Opening Journal (go-live)").
 * The opening journal has no draft: the backend derives every line from MAS
 * `opening_balance` and posts atomically. This file additionally binds a mock-only
 * `GET /api/journal/opening/preview` — a Phase-1 shim that returns the derived
 * lines the wizard renders on load. The real backend either supplies such a preview
 * endpoint or the FE derives from MAS (SRS §15/§16 — resolution PENDING).
 */

function csrf() {
  return { csrfToken: readCsrfToken() };
}

export interface OpeningLine {
  lineNo: number;
  section: "ACCOUNT" | "PARTY_AR" | "PARTY_AP" | "EQUITY";
  accountLabel: string;
  partyLabel: string | null;
  debit: string;
  credit: string;
}

export interface OpeningPreview {
  lines: OpeningLine[];
  totalDebit: string;
  totalCredit: string;
  configGap: boolean; // OPENING_ACCOUNT_NOT_CONFIGURED equivalent
}

export interface OpeningPostBody {
  voucherDate: string; // YYYY-MM-DD
  narration: string | null;
}

export async function getOpeningPreview(): Promise<OpeningPreview> {
  const res = await apiClient.get<{ data: OpeningPreview }>("/journal/opening/preview");
  return res.data;
}

export async function postOpeningJournal(input: OpeningPostBody): Promise<JournalVoucher> {
  const res = await apiClient.post<{ data: JournalVoucher }>("/journal/opening", input, csrf());
  return res.data;
}

/** Does an OPENING voucher already exist for this company (FR-GEN-012)? */
export async function findExistingOpening(): Promise<JournalVoucherSummary | null> {
  const page = await listJournalVouchers({ voucherType: "OPENING", page: 1, pageSize: 5 });
  const first = page.data.find((v) => v.voucherType === "OPENING");
  return (first as JournalVoucherSummary | undefined) ?? null;
}
