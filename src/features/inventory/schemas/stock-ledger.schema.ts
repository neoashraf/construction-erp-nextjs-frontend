import { parseDate } from "@/lib/format";
import { type StockMovementSourceType } from "../types";

/**
 * Stock-ledger view helpers (spec §5/§7/§8). Read-only screen — these are query-filter
 * + display helpers, not a writing form. Grouping is a client-side re-sort of the same
 * `StockLedgerRow[]` payload; source labels/routes map a movement's `sourceType` to its
 * originating-voucher screen (FR-INV-006).
 */

export type LedgerGroupBy = "godown" | "item";
export const LEDGER_GROUP_BY: readonly LedgerGroupBy[] = ["godown", "item"];
export const GROUP_BY_LABEL: Record<LedgerGroupBy, string> = {
  godown: "By godown",
  item: "By item",
};

/** Balances filter state (as-of dates held as `DD/MM/YYYY` UI strings; "" = Latest). */
export interface LedgerFilter {
  godownId: string;
  itemId: string;
  projectId: string;
  asOfDate: string; // DD/MM/YYYY or "" (Latest)
}

export const emptyLedgerFilter: LedgerFilter = {
  godownId: "",
  itemId: "",
  projectId: "",
  asOfDate: "",
};

export function isLedgerFiltered(f: LedgerFilter): boolean {
  return Boolean(f.godownId || f.itemId || f.projectId || f.asOfDate);
}

/** Movement-history date-window state (both `DD/MM/YYYY` UI strings). */
export interface MovementFilter {
  dateFrom: string;
  dateTo: string;
}

export const emptyMovementFilter: MovementFilter = { dateFrom: "", dateTo: "" };

/**
 * Convert a `DD/MM/YYYY` UI date to the API's `YYYY-MM-DD`. Returns `null` for an empty
 * string (the caller omits the param → "Latest"); throws `INVALID_DATE` for a malformed
 * one so the caller can surface "Enter a valid date." (spec §7).
 */
export function uiDateToApi(value: string): string | null {
  const v = value.trim();
  if (v === "") return null;
  const d = parseDate(v); // throws on malformed / invalid calendar date
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** True when a `DD/MM/YYYY` string is a complete, valid calendar date (empty = valid/omitted). */
export function isValidUiDate(value: string): boolean {
  if (value.trim() === "") return true;
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}

/** Display labels for each source-voucher type (spec §8). */
export const SOURCE_LABEL: Record<StockMovementSourceType, string> = {
  STOCK_JOURNAL: "Stock Journal",
  GRN: "Goods Receipt",
  REQ_ISSUE: "Requisition Issue",
};

/**
 * Route a movement to its originating voucher's read view (FR-INV-006): a `STOCK_JOURNAL`
 * resolves to this module's Stock Journal viewer; `GRN`/`REQ_ISSUE` resolve to the PUR/REQ
 * module screens (owned there, out of scope here). Returns `null` when the source can't be
 * resolved (no id / scoped out) → the row renders "(view unavailable)" plain text (spec §6).
 */
export function sourceHref(sourceType: StockMovementSourceType, sourceId: string | null): string | null {
  if (!sourceId) return null;
  switch (sourceType) {
    case "STOCK_JOURNAL":
      return `/inventory/stock-journals/${sourceId}`;
    case "GRN":
      return `/purchase/bills/${sourceId}`;
    case "REQ_ISSUE":
      return `/requisitions/issues/${sourceId}`;
  }
}
