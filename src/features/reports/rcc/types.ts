/**
 * FE-59 fe-requisition-cost-control-reports — row + totals shapes for the two
 * reports in this viewer (FR-RPT-024/025, contract 15 § "Requisition &
 * cost-control reports"). Reuses FE-54's `ReportResult<Row>` envelope.
 */

export type RccReportTab = "REQUISITION_VS_ISSUE" | "COST_CENTRE_VARIANCE";

export const REPORT_NAME: Record<RccReportTab, string> = {
  REQUISITION_VS_ISSUE: "requisition-vs-issue",
  COST_CENTRE_VARIANCE: "cost-centre-variance",
};

export interface RequisitionVsIssueRow {
  requisitionId: string;
  requisitionNo: string;
  projectId: string | null;
  projectName: string | null;
  costCentreId: string | null;
  costCentreCode: string | null;
  costCentreName: string | null;
  itemId: string;
  itemCode: string | null;
  itemName: string | null;
  unit?: string | null;
  requestedQty: string;
  issuedQty: string;
  /** REQ's own derived value: requestedQty − issuedQty. */
  varianceQty: string;
  costCentreInactive?: boolean;
  itemInactive?: boolean;
}

export interface RequisitionVsIssueTotals {
  lineCount: number | string;
  fullyIssued: number | string;
  outstanding: number | string;
}

export type CostCentreVarianceStatus = "OK" | "APPROACHING" | "OVER" | "UNBUDGETED";

export interface CostCentreVarianceRow {
  projectId: string;
  projectName: string | null;
  costCentreId: string;
  costCentreCode: string | null;
  costCentreName: string | null;
  budgetedAmount: string | null;
  actualCost: string;
  variance: string | null;
  utilisationPct: string | null;
  status: CostCentreVarianceStatus;
}

export interface CostCentreVarianceTotals {
  budgeted: string;
  actual: string;
  variance: string;
}
