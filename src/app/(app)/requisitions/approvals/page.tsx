import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ApprovalsWorklistScreen } from "@/features/requisitions/components/ApprovalsWorklistScreen";

/**
 * Requisition approvals worklist route (REQ; FR-REQ-008…-011) — under the (app) shell + the
 * `requisitions` module guard, resource `requisitions.approvals`. The review queue of
 * SUBMITTED requisitions; rows open the decision detail. Non-approver roles get the
 * permission-denied view inside the screen; the server re-checks the exact grant.
 */
export default async function RequisitionApprovalsPage() {
  await requireModuleAccess("requisitions");
  return <ApprovalsWorklistScreen />;
}
