import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PoListScreen } from "@/features/purchase/components/PoListScreen";

/**
 * Purchase Orders list route (PUR; FR-PUR-001/-002) — under the (app) shell + the
 * `purchase` module guard. Read for all PUR-scoped roles; the server scopes PM to
 * assigned projects. The "New PO" CTA is gated per-actor inside the screen.
 */
export default async function PurchaseOrdersPage() {
  await requireModuleAccess("purchase");
  return <PoListScreen />;
}
