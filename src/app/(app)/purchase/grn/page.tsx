import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { GrnListScreen } from "@/features/purchase/components/GrnListScreen";

/**
 * GRN & matching — list route (nav-tree route /purchase/grn, resource
 * `purchase.grn`). Guarded by the `purchase` module gate; the list is a READ-only
 * register (server scopes PM to assigned projects). The "New GRN" CTA is hidden
 * for actors without `purchase.grn:CREATE` (Store Keeper only per spec §11).
 */
export default async function PurchaseGrnPage() {
  await requireModuleAccess("purchase");
  return <GrnListScreen />;
}
