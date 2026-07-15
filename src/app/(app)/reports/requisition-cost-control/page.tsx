import { RequisitionCostControlView } from "@/features/reports/rcc/components/RequisitionCostControlView";

/**
 * FE-59 fe-requisition-cost-control-reports — the two-report REQ + CC viewer
 * (child of `/reports`). Guarded on `reports:READ` by the module registry.
 */
export const dynamic = "force-dynamic";

export default function RequisitionCostControlReportsPage() {
  return <RequisitionCostControlView />;
}
