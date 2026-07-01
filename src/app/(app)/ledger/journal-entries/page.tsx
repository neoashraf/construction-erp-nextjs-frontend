import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { JournalEntriesScreen } from "@/features/ledger/components/JournalEntriesScreen";

/**
 * Journal entries route (LED; FR-LED-031/005/030/026) — under the (app) shell + the
 * `ledger` module guard. Read-only: lists posted entry headers; the server further
 * scopes a Project Manager to assigned-project entries and re-checks every read
 * (`403 FORBIDDEN`), which the screen renders as the permission-denied view.
 */
export default async function JournalEntriesPage() {
  await requireModuleAccess("ledger");
  return <JournalEntriesScreen />;
}
