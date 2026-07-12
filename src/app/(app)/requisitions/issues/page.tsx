import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { IssuesWorklistScreen } from "@/features/requisitions/components/IssuesWorklistScreen";

/**
 * Requisition issues worklist route (REQ; FR-REQ-012…-023) — under the (app) shell + the
 * `requisitions` module guard, resource `requisitions.issues`. The fulfilment queue of
 * APPROVED/PARTIALLY_ISSUED requisitions; rows open the issue detail. Non-viewers get the
 * permission-denied view inside the screen; the server re-checks the exact grant.
 */
export default async function RequisitionIssuesPage() {
  await requireModuleAccess("requisitions");
  return <IssuesWorklistScreen />;
}
