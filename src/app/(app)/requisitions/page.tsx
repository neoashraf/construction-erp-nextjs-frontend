import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { RequisitionListScreen } from "@/features/requisitions/components/RequisitionListScreen";

/**
 * Requisition list route (REQ; FR-REQ-021/-022) — under the (app) shell + the `requisitions`
 * module guard. Read for all REQ-scoped roles; the server scopes PM/Site Engineer/Store
 * Keeper to assigned projects. The "New requisition" CTA is gated per-actor inside the screen.
 */
export default async function RequisitionsPage() {
  await requireModuleAccess("requisitions");
  return <RequisitionListScreen />;
}
