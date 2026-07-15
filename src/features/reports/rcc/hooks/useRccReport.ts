"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { runReport } from "../../api/reports";
import { type ReportParams, type ReportResult } from "../../types";
import {
  REPORT_NAME,
  type CostCentreVarianceRow,
  type CostCentreVarianceTotals,
  type RccReportTab,
  type RequisitionVsIssueRow,
  type RequisitionVsIssueTotals,
} from "../types";

export interface RequisitionVsIssueResult extends ReportResult<RequisitionVsIssueRow> {
  meta: ReportResult<RequisitionVsIssueRow>["meta"] & { totals?: Partial<RequisitionVsIssueTotals> };
}
export interface CostCentreVarianceResult extends ReportResult<CostCentreVarianceRow> {
  meta: ReportResult<CostCentreVarianceRow>["meta"] & { totals?: Partial<CostCentreVarianceTotals> };
}
export type AnyRccResult = RequisitionVsIssueResult | CostCentreVarianceResult;
type AnyRow = RequisitionVsIssueRow | CostCentreVarianceRow;

export function useRccReport(
  tab: RccReportTab,
  params: ReportParams | null,
  enabled: boolean,
) {
  const user = useAuthenticatedUser();
  return useQuery<AnyRccResult>({
    queryKey: queryKeys.detail(
      "reports",
      "rcc",
      `${user.companyId}:${user.financialYearId}:${REPORT_NAME[tab]}:${JSON.stringify(params ?? {})}`,
    ),
    queryFn: () =>
      runReport<AnyRow>(REPORT_NAME[tab], params!).then(
        (r) => r as unknown as AnyRccResult,
      ),
    enabled: !!params && enabled,
    retry: false,
    staleTime: 0,
  });
}

export function errorTitleFor(tab: RccReportTab): string {
  switch (tab) {
    case "REQUISITION_VS_ISSUE": return "Couldn't load requisition vs issue.";
    case "COST_CENTRE_VARIANCE": return "Couldn't load cost-centre variance.";
  }
}
export function subtitleFor(tab: RccReportTab): string {
  switch (tab) {
    case "REQUISITION_VS_ISSUE":
      return "Requested / issued / variance per requisition line — REQ's numbers, verbatim.";
    case "COST_CENTRE_VARIANCE":
      return "Budgeted vs actual per (project, cost centre) — CC's classification, verbatim.";
  }
}
export function breadcrumbFor(tab: RccReportTab): string {
  switch (tab) {
    case "REQUISITION_VS_ISSUE": return "Requisition vs issue";
    case "COST_CENTRE_VARIANCE": return "Cost-centre variance";
  }
}
