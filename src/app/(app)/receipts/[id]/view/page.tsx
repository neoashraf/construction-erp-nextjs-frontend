import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ReceiptViewer } from "@/features/receipts/components/ReceiptViewer";

/**
 * Receipt viewer route (REC; FR-REC-013/-021/-024) — under the (app) shell + the
 * `receipts` module guard (`receipts:READ`). Read-only for the receipt itself; opens
 * only for a POSTED/CANCELLED receipt (a DRAFT id redirects client-side to the editor;
 * a missing id is the 404 state). Cancel/Repost are `receipts:CANCEL`-gated.
 */
export default async function ReceiptViewerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("receipts");
  const { id } = await params;
  return <ReceiptViewer receiptId={id} />;
}
