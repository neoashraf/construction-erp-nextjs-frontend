import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PaymentViewer } from "@/features/payments/components/PaymentViewer";

/**
 * Payment viewer route (PAY; FR-PAY-013/-018) — under the (app) shell + the
 * `payments` module guard (`payments.list:READ`). Read-only for the payment itself;
 * opens only for POSTED/CANCELLED (a DRAFT id redirects to the editor; a missing id
 * is 404). Cancel/Correct are `payments.list:CANCEL`-gated.
 */
export default async function PaymentViewerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("payments");
  const { id } = await params;
  return <PaymentViewer paymentId={id} />;
}
