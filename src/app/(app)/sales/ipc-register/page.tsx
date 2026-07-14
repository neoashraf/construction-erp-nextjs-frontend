import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { IpcRegisterScreen } from "@/features/sales-ipc/components/IpcRegisterScreen";

/**
 * IPC register + retention route (SAL; FR-SAL-015…-020) — under the (app) shell + the
 * `sales` module guard (`sales.ipc_register:READ`). The retention Release action inside the
 * screen is separately gated on `sales:release-retention` (server-authoritative); the
 * catalogue action-code gap for that action is flagged to the AUD/design owner in the brief.
 */
export default async function SalesIpcRegisterPage() {
  await requireModuleAccess("sales");
  return <IpcRegisterScreen />;
}
