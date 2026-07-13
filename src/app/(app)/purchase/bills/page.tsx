import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { BillListScreen } from "@/features/purchase/components/BillListScreen";

/**
 * Purchase Bills list route (PUR; FR-PUR-020, FR-PUR-021) — under the (app) shell + the
 * `purchase` module guard. The list is `purchase.bills:READ`-guarded; PM is scoped to
 * assigned projects server-side (out-of-scope rows are excluded silently). The "New bill"
 * CTA is hidden for actors without `purchase:write`.
 */
export default async function PurchaseBillsPage() {
  await requireModuleAccess("purchase");
  return <BillListScreen />;
}
