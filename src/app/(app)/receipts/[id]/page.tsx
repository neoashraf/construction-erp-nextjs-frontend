import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ReceiptEditor } from "@/features/receipts/components/ReceiptEditor";

/**
 * Receipt editor route (REC; FR-REC-001…-020, -024) — under the (app) shell + the
 * `receipts` module guard (`receipts:READ`). `"new"` opens a blank DRAFT with the mode
 * picker; any other id loads the receipt — if POSTED/CANCELLED, the editor redirects
 * client-side to `/receipts/[id]/view` (FE-44) so a posted receipt never re-opens here.
 */
export default async function ReceiptEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("receipts");
  const { id } = await params;
  return <ReceiptEditor receiptId={id === "new" ? null : id} />;
}
