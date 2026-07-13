import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { RequisitionApprovalDetail } from "@/features/requisitions/components/RequisitionApprovalDetail";

/**
 * Requisition review / approval detail route (REQ; FR-REQ-005…-011) — under the (app) shell +
 * the `requisitions` module guard, resource `requisitions.approvals`. Renders the SUBMITTED
 * requisition read-only and gates Approve/Reject per tier + project scope inside the screen;
 * the server re-validates every decision (`APPROVAL_BEYOND_AUTHORITY` / `REQUISITION_NOT_SUBMITTED`).
 */
export default async function RequisitionApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("requisitions");
  const { id } = await params;
  return <RequisitionApprovalDetail requisitionId={id} />;
}
