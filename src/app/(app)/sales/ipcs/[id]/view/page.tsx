import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { IpcViewer } from "@/features/sales-ipc/components/IpcViewer";

/**
 * IPC viewer route (SAL; FR-SAL-010/-012/-016/-021/-022) — under the (app) shell + the
 * `sales` module guard (`sales.ipcs:READ`). Read-only for POSTED/CANCELLED IPCs; a
 * DRAFT id redirects to the editor; a missing id is the 404 state. Correct/Cancel are
 * navigation links to the editor's permissioned actions (never in-place here).
 */
export default async function SalesIpcViewerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("sales");
  const { id } = await params;
  return <IpcViewer ipcId={id} />;
}
