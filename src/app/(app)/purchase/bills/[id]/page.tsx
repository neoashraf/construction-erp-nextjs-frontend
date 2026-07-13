import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { BillDetailDispatch } from "@/features/purchase/components/BillDetailDispatch";

/**
 * Purchase Bill editor / read-only viewer route (PUR; FR-PUR-004…-024) — under the (app)
 * shell + the `purchase` module guard. `id="new"` opens a blank DRAFT editor; a UUID
 * opens either the DRAFT editor or the POSTED/CANCELLED viewer, dispatched by the
 * bill's `status` (client-side; the load is one shared query so it doesn't refetch).
 */
export default async function PurchaseBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleAccess("purchase");
  const { id } = await params;
  return <BillDetailDispatch billId={id === "new" ? null : id} />;
}
