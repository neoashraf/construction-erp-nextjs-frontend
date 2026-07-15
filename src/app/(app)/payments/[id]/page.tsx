import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { PaymentEditor } from "@/features/payments/components/PaymentEditor";

/**
 * Payment editor route (PAY; FR-PAY-001…-020) — under the (app) shell + the
 * `payments` module guard (`payments.list:READ`). `"new"` opens a blank draft; any
 * other id loads the payment — editable while DRAFT, otherwise a read-only surface
 * with Cancel/Correct actions.
 */
export default async function PaymentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("payments");
  const { id } = await params;
  return <PaymentEditor paymentId={id === "new" ? null : id} />;
}
