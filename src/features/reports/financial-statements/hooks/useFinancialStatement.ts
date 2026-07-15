import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { runReport } from "../../api/reports";
import { type ReportParams, type ReportResult } from "../../types";
import {
  type BalanceSheetRow,
  type BalanceSheetTotals,
  type PnlTotals,
  type ProjectPnlRow,
  type StatementTab,
} from "../types";

/**
 * FE-55 hook — wraps the shared `runReport` for the two financial-statement
 * endpoints. The result is only fetched once `Run` has been pressed at least
 * once (the parent tracks the "run" latch). Params are the merged panel state.
 */

export interface PnlResult extends ReportResult<ProjectPnlRow> {
  meta: ReportResult<ProjectPnlRow>["meta"] & { totals?: Partial<Record<keyof PnlTotals, string>> };
}
export interface BsResult extends ReportResult<BalanceSheetRow> {
  meta: ReportResult<BalanceSheetRow>["meta"] & {
    totals?: Partial<Record<keyof BalanceSheetTotals, string>>;
  };
}

export function useFinancialStatement(
  tab: StatementTab,
  params: ReportParams | null,
  enabled: boolean,
) {
  const user = useAuthenticatedUser();
  const name = tab === "PNL" ? "profit-and-loss" : "balance-sheet";
  return useQuery<PnlResult | BsResult>({
    queryKey: queryKeys.detail(
      "reports",
      "financial-statement",
      `${user.companyId}:${user.financialYearId}:${name}:${JSON.stringify(params ?? {})}`,
    ),
    queryFn: () =>
      runReport<ProjectPnlRow | BalanceSheetRow>(name, params!).then(
        (r) => r as PnlResult | BsResult,
      ),
    enabled: !!params && enabled,
    retry: false,
    staleTime: 0,
  });
}
