import { requireResourceAccess } from "@/lib/auth/guard-module-page";
import { canReadOpenPayables } from "@/features/payments/access";
import { PaymentListScreen } from "@/features/payments/components/PaymentListScreen";

/**
 * Open payables — the Outstanding view's own route (nav-tree `/payments/open-payables`,
 * resource `payments.open_payables`). NOT a separate screen: two nav entries, one screen
 * (payment-list.md §3), so this renders the same `PaymentListScreen` opened on the
 * Outstanding view. Replaces the FE-SHELL ComingSoon placeholder (FE-63).
 *
 * Accepts the §9 deep link `?partyId=&payableType=&payableId=` — the Payment viewer's
 * allocations panel links a settled payable straight to its outstanding row.
 *
 * Guarded on its OWN resource (`payments.open_payables:READ`), not just module access —
 * an actor holding `payments.list` alone gets /403 here (spec §6). The hidden tab in the
 * segmented control is UX; this is the gate.
 */
export default async function PaymentsOpenPayablesPage() {
  await requireResourceAccess("payments", canReadOpenPayables);
  return <PaymentListScreen initialView="OUTSTANDING" />;
}
