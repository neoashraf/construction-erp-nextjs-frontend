import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { IpcEditor } from "@/features/sales-ipc/components/IpcEditor";

/**
 * IPC editor route (SAL; FR-SAL-001…-024) — under the (app) shell + the `sales` module guard
 * (`sales.ipcs:READ`). `"new"` opens a blank DRAFT; any other id loads the IPC (editable while
 * DRAFT, else a read-only posted/cancelled form). Write actions (Save/Post/Cancel/Repost) are
 * gated per-actor inside the editor and re-checked server-side.
 */
export default async function SalesIpcEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleAccess("sales");
  const { id } = await params;
  return <IpcEditor ipcId={id === "new" ? null : id} />;
}
