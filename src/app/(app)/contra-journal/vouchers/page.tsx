import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { VoucherListScreen } from "@/features/contra-journal/components/VoucherListScreen";

/**
 * Contra & Journal — voucher list route (nav-tree /contra-journal/vouchers, resource
 * `contra_journal.vouchers`). Guarded on `contra-journal:READ`; a read-only unified
 * list over `GET /api/contra` + `GET /api/journal` (server enforces per-record
 * permissions).
 */
export default async function ContraJournalVouchersPage() {
  await requireModuleAccess("contra-journal");
  return <VoucherListScreen />;
}
