import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { StockJournalListScreen } from "@/features/inventory/components/StockJournalListScreen";

/**
 * Stock Journal list route (INV; FR-INV-022) — under the (app) shell + the `inventory`
 * module guard. Read for all INV-scoped roles; the server scopes PM/Store Keeper to
 * assigned projects and re-checks every read (`403 FORBIDDEN`). Write affordances (New /
 * lifecycle actions) are gated per-actor inside the screens.
 */
export default async function StockJournalsPage() {
  await requireModuleAccess("inventory");
  return <StockJournalListScreen />;
}
