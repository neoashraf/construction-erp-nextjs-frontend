import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PaymentListScreen } from "@/features/payments/components/PaymentListScreen";

/**
 * Payments — list + outstanding route (nav-tree /payments, resource
 * `payments.list`). Guarded on `payments.list:READ`; the list is read-only
 * (server scopes PM out of this screen — spec §11). Segmented control switches
 * to the Outstanding view (per-payable open balance) inside the same route.
 */
export default async function PaymentsPage() {
  await requireModuleAccess("payments");
  return <PaymentListScreen />;
}
