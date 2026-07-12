import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { IpcList } from "@/features/sales-ipc/components/IpcList";

/**
 * IPC list route (SAL; FR-SAL-015/-016) — under the (app) shell + the `sales` module guard
 * (`sales.ipcs:READ`). Read for Accounts + Admin (company-wide) and Project Manager (assigned
 * projects, scoped server-side). The "New IPC" CTA is gated per-actor inside the screen; the
 * server re-checks every action regardless.
 */
export default async function SalesIpcsPage() {
  await requireModuleAccess("sales");
  return <IpcList />;
}
