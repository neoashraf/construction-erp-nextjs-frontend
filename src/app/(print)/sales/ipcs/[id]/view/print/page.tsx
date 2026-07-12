import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { MushakPrintPreviewScreen } from "@/features/sales-ipc/components/MushakPrintPreviewScreen";

/**
 * Mushak 6.3 print-preview route (SAL; FR-SAL-024) — outside the app shell so the
 * preview fills the browser window and prints cleanly. Guarded on `sales.ipcs:READ`;
 * loads the IPC + company + customer party client-side and renders the statutory
 * document. Opens in a new tab from the viewer's Print action.
 */
export default async function MushakPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("sales");
  const { id } = await params;
  return <MushakPrintPreviewScreen ipcId={id} />;
}
