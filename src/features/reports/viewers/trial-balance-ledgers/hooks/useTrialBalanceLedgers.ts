import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { runReport } from "../../../api/reports";
import { type ReportParams, type ReportResult } from "../../../types";
import {
  type LedgerMeta,
  type LedgerRow,
  type ReportTab,
  type TrialBalanceRow,
  type TrialBalanceTotals,
} from "../types";

/** Map the tab id → REST endpoint slug. */
export const REPORT_NAME: Record<ReportTab, string> = {
  TB: "trial-balance",
  LEDGER: "account-ledger",
  DAYBOOK: "daybook",
  CASH_BANK: "cash-bank-book",
};

/**
 * FE-56 hook. Per-tab result type is discriminated by `tab`; the caller casts
 * the returned `rows`/`meta` accordingly. `enabled` gates the query so Run has
 * to be pressed at least once before the fetch fires.
 */
export interface TrialBalanceResult extends ReportResult<TrialBalanceRow> {
  meta: ReportResult<TrialBalanceRow>["meta"] & {
    totals?: Partial<TrialBalanceTotals>;
  };
}

export interface LedgerResult extends ReportResult<LedgerRow> {
  meta: ReportResult<LedgerRow>["meta"] & {
    openingBalance?: string;
    openingAsOf?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export function useReportForTab(
  tab: ReportTab,
  params: ReportParams | null,
  enabled: boolean,
) {
  const user = useAuthenticatedUser();
  return useQuery<TrialBalanceResult | LedgerResult>({
    queryKey: queryKeys.detail(
      "reports",
      "tb-ledgers",
      `${user.companyId}:${user.financialYearId}:${REPORT_NAME[tab]}:${JSON.stringify(params ?? {})}`,
    ),
    queryFn: () =>
      runReport<TrialBalanceRow | LedgerRow>(REPORT_NAME[tab], params!).then(
        (r) => r as TrialBalanceResult | LedgerResult,
      ),
    enabled: !!params && enabled,
    retry: false,
    staleTime: 0,
  });
}

/** Helper — normalise LedgerMeta from a query result (defaults for older payloads). */
export function readLedgerMeta(meta: LedgerResult["meta"]): LedgerMeta {
  return {
    openingBalance: meta.openingBalance ?? "0.0000",
    openingAsOf: meta.openingAsOf ?? "",
    dateFrom: meta.dateFrom ?? "",
    dateTo: meta.dateTo ?? "",
  };
}
