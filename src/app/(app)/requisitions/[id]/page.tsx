import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { RequisitionEntryForm } from "@/features/requisitions/components/RequisitionEntryForm";

/**
 * Requisition entry / viewer route (REQ; FR-REQ-001…-009/-022) — under the (app) shell + the
 * `requisitions` module guard. `id="new"` opens a blank DRAFT form; a uuid opens the DRAFT
 * editor or the read-only viewer (SUBMITTED+). Create/submit/delete are gated per-actor
 * inside the form; the server re-checks every action.
 */
export default async function RequisitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("requisitions");
  const { id } = await params;
  return <RequisitionEntryForm requisitionId={id === "new" ? null : id} />;
}
