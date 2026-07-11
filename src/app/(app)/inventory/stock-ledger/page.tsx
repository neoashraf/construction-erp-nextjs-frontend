import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { StockLedgerScreen } from "@/features/inventory/components/StockLedgerScreen";

/**
 * Stock Ledger route (INV; FR-INV-001/004/006/021) — under the (app) shell + the
 * `inventory` module guard. Read-only for all INV-scoped roles; the server scopes
 * PM/Store Keeper to assigned projects' godowns and re-checks every read (`403`). There is
 * no write endpoint here — balances change only by posting/reversing a voucher elsewhere.
 */
export default async function StockLedgerPage() {
  await requireModuleAccess("inventory");
  return <StockLedgerScreen />;
}
