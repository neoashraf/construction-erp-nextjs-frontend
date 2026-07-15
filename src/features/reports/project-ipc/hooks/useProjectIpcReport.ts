"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { runReport } from "../../api/reports";
import { type ReportParams } from "../../types";
import {
  REPORT_NAME,
  type CostCentreVarianceRow,
  type IpcBillingRow,
  type LabourCostRow,
  type ProjectPnlRow,
  type ProjectReportTab,
} from "../types";
import {
  type IpcBillingResult,
  type LabourCostResult,
  type MaterialConsumptionResult,
  type OutstandingResult,
  type ProjectPnlResult,
} from "../api/project-reports";

/**
 * FE-57 unified hook — one query per (tab, params). Row/meta typing is a
 * discriminated union the viewer casts down; `enabled` gates the fetch so Run
 * has to be pressed at least once (and, for Project P&L, a project chosen).
 */
export type AnyProjectRow = ProjectPnlRow | IpcBillingRow | CostCentreVarianceRow | LabourCostRow;
export type AnyProjectResult =
  | ProjectPnlResult
  | IpcBillingResult
  | OutstandingResult
  | MaterialConsumptionResult
  | LabourCostResult;

export function useProjectIpcReport(
  tab: ProjectReportTab,
  params: ReportParams | null,
  enabled: boolean,
) {
  const user = useAuthenticatedUser();
  return useQuery<AnyProjectResult>({
    queryKey: queryKeys.detail(
      "reports",
      "project-ipc",
      `${user.companyId}:${user.financialYearId}:${REPORT_NAME[tab]}:${JSON.stringify(params ?? {})}`,
    ),
    queryFn: () =>
      runReport<AnyProjectRow>(REPORT_NAME[tab], params!).then(
        (r) => r as unknown as AnyProjectResult,
      ),
    enabled: !!params && enabled,
    retry: false,
    staleTime: 0,
  });
}

/** Convenience — narrow a raw ReportResult to the tab's concrete shape. */
export function isProjectPnl(tab: ProjectReportTab): tab is "PROJECT_PNL" {
  return tab === "PROJECT_PNL";
}
export function isIpcBilling(tab: ProjectReportTab): tab is "IPC_BILLING" {
  return tab === "IPC_BILLING";
}
export function isOutstanding(tab: ProjectReportTab): tab is "OUTSTANDING" {
  return tab === "OUTSTANDING";
}
export function isMaterialConsumption(
  tab: ProjectReportTab,
): tab is "MATERIAL_CONSUMPTION" {
  return tab === "MATERIAL_CONSUMPTION";
}
export function isLabourCost(tab: ProjectReportTab): tab is "LABOUR_COST" {
  return tab === "LABOUR_COST";
}

/** Report-specific empty-state copy (spec §6/§8). */
export function emptyLabelFor(tab: ProjectReportTab): string {
  switch (tab) {
    case "PROJECT_PNL":
      return "No postings for this project in this period.";
    case "IPC_BILLING":
      return "No IPCs raised for this project yet.";
    default:
      return "No results for these filters.";
  }
}

/** Report-specific error-banner title (spec §6). */
export function errorTitleFor(tab: ProjectReportTab): string {
  switch (tab) {
    case "PROJECT_PNL":
      return "Couldn't load the project P&L.";
    case "IPC_BILLING":
      return "Couldn't load the IPC report.";
    case "OUTSTANDING":
      return "Couldn't load the outstanding report.";
    case "MATERIAL_CONSUMPTION":
      return "Couldn't load material consumption vs budget.";
    case "LABOUR_COST":
      return "Couldn't load labour cost.";
  }
}

/** The prose caption under `<h2>` per tab (spec §5, mirrors the design file). */
export function subtitleFor(tab: ProjectReportTab): string {
  switch (tab) {
    case "PROJECT_PNL":
      return "Revenue − cost per cost centre, with the project total.";
    case "IPC_BILLING":
      return "Per-IPC certified / billed / received / outstanding + ageing.";
    case "OUTSTANDING":
      return "Per-IPC outstanding, grouped by project.";
    case "MATERIAL_CONSUMPTION":
      return "Consumed material cost vs cost-centre budget.";
    case "LABOUR_COST":
      return "Labour EXPENSE (accrual), grouped by cost centre.";
  }
}

/** Breadcrumb tail per active tab (spec §3.1). */
export function breadcrumbFor(tab: ProjectReportTab): string {
  switch (tab) {
    case "PROJECT_PNL":
      return "Project P&L";
    case "IPC_BILLING":
      return "IPC report";
    case "OUTSTANDING":
      return "Outstanding";
    case "MATERIAL_CONSUMPTION":
      return "Material consumption vs budget";
    case "LABOUR_COST":
      return "Labour cost";
  }
}

