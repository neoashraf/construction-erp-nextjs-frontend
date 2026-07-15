/**
 * FE-57 typed bindings for the five project-lens report endpoints (contract 15
 * § "Project reports"). Delegates to FE-54's `runReport` helper — this module
 * is purely a type surface so callers get concrete row/totals shapes.
 */
import { runReport } from "../../api/reports";
import { type ReportParams, type ReportResult } from "../../types";
import {
  type CostCentreVarianceRow,
  type CostCentreVarianceTotals,
  type IpcBillingRow,
  type IpcBillingTotals,
  type LabourCostRow,
  type LabourCostTotals,
  type OutstandingProjectTotals,
  type ProjectPnlRow,
  type ProjectPnlTotals,
} from "../types";

export interface ProjectPnlResult extends ReportResult<ProjectPnlRow> {
  meta: ReportResult<ProjectPnlRow>["meta"] & { totals?: Partial<ProjectPnlTotals> };
}
export interface IpcBillingResult extends ReportResult<IpcBillingRow> {
  meta: ReportResult<IpcBillingRow>["meta"] & { totals?: Partial<IpcBillingTotals> };
}
export interface OutstandingResult extends ReportResult<IpcBillingRow> {
  meta: ReportResult<IpcBillingRow>["meta"] & {
    totals?: Partial<IpcBillingTotals>;
    projectTotals?: OutstandingProjectTotals;
  };
}
export interface MaterialConsumptionResult extends ReportResult<CostCentreVarianceRow> {
  meta: ReportResult<CostCentreVarianceRow>["meta"] & {
    totals?: Partial<CostCentreVarianceTotals>;
  };
}
export interface LabourCostResult extends ReportResult<LabourCostRow> {
  meta: ReportResult<LabourCostRow>["meta"] & { totals?: Partial<LabourCostTotals> };
}

export function runProjectPnl(params: ReportParams): Promise<ProjectPnlResult> {
  return runReport<ProjectPnlRow>("project-pnl", params).then((r) => r as ProjectPnlResult);
}
export function runIpcBilling(params: ReportParams): Promise<IpcBillingResult> {
  return runReport<IpcBillingRow>("ipc-billing", params).then((r) => r as IpcBillingResult);
}
export function runOutstanding(params: ReportParams): Promise<OutstandingResult> {
  return runReport<IpcBillingRow>("outstanding", params).then((r) => r as OutstandingResult);
}
export function runMaterialConsumption(
  params: ReportParams,
): Promise<MaterialConsumptionResult> {
  return runReport<CostCentreVarianceRow>("material-consumption-vs-budget", params).then(
    (r) => r as MaterialConsumptionResult,
  );
}
export function runLabourCost(params: ReportParams): Promise<LabourCostResult> {
  return runReport<LabourCostRow>("labour-cost", params).then((r) => r as LabourCostResult);
}
