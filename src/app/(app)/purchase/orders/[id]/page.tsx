import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PoEditor } from "@/features/purchase/components/PoEditor";

/**
 * Purchase Order editor / read-only viewer route (PUR; FR-PUR-001…-024) — under the (app)
 * shell + the `purchase` module guard. `id="new"` opens a blank DRAFT form; a UUID opens
 * the DRAFT editor or the read-only viewer (APPROVED+). Save/Approve/Cancel are gated
 * per-actor inside the form; the server re-checks every action.
 */
export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("purchase");
  const { id } = await params;
  return <PoEditor poId={id === "new" ? null : id} />;
}
