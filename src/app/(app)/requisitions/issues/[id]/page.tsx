import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { RequisitionIssueDetail } from "@/features/requisitions/components/RequisitionIssueDetail";

/**
 * Requisition issue detail route (REQ; FR-REQ-012…-023) — under the (app) shell + the
 * `requisitions` module guard, resource `requisitions.issues`. Issue / Manual Close / Reverse
 * are gated per role inside the screen; the server re-validates every ledger-touching call
 * (`NEGATIVE_STOCK_BLOCKED` / `ISSUE_EXCEEDS_BALANCE` / `PERIOD_CLOSED` / …).
 */
export default async function RequisitionIssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("requisitions");
  const { id } = await params;
  return <RequisitionIssueDetail requisitionId={id} />;
}
