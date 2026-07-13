import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ReceiptListScreen } from "@/features/receipts/components/ReceiptListScreen";

/**
 * Receipts — list route (nav-tree route /receipts, resource `receipts`). Guarded on
 * `receipts:READ`; a read-only collection register (server scopes PM to assigned
 * projects, general no-project receipts excluded — spec §11). Arriving with `?ipcId=`
 * (from an IPC's "View receipts applied", FR-REC-016) pre-filters to that IPC.
 */
export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleAccess("receipts");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return <ReceiptListScreen initialIpcId={one(sp.ipcId)} />;
}
