import { requireResourceAccess } from "@/lib/auth/guard-module-page";
import { canReadPayment } from "@/features/payments/access";
import { PaymentListScreen } from "@/features/payments/components/PaymentListScreen";

/**
 * Payments — the voucher-list route (nav-tree `/payments`, resource `payments.list`).
 * Guarded on `payments.list:READ`; the list is read-only (server scopes PM out of this
 * screen — spec §11). The segmented control's "Outstanding" tab NAVIGATES to this
 * screen's sibling route `/payments/open-payables`, which has its own nav entry
 * (payment-list.md §3) — it no longer toggles a view inside this one route.
 */
export default async function PaymentsPage() {
  await requireResourceAccess("payments", canReadPayment);
  return <PaymentListScreen initialView="PAYMENTS" />;
}
