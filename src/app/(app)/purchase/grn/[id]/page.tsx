import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { GrnEntry } from "@/features/purchase/components/GrnEntry";

/**
 * GRN entry / posted read-only route (PUR; FR-PUR-015/-016/-024). Under the
 * `(app)` shell + the `purchase` module guard. `id="new"` opens a blank DRAFT
 * entry; a UUID opens the DRAFT entry or the POSTED read-only view, dispatched
 * by the GRN's `status` inside the component. Server re-checks `purchase.grn`
 * scope; write actions ("New GRN", Save, Post) further gate on Store Keeper.
 */
export default async function PurchaseGrnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("purchase");
  const { id } = await params;
  return <GrnEntry grnId={id === "new" ? null : id} />;
}
