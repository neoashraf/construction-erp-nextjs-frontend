import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { TrialBalanceScreen } from "@/features/ledger/components/TrialBalanceScreen";

/**
 * Trial balance route (LED; FR-LED-031/001/014/007) — under the (app) shell + the
 * `ledger` module guard. Read-only: aggregated debit/credit/net balances per account
 * proving `Σdebit = Σcredit`; the server further scopes a Project Manager to
 * assigned-project balances and re-checks every read (`403 FORBIDDEN`), which the
 * screen renders as the permission-denied view.
 */
export default async function TrialBalancePage() {
  await requireModuleAccess("ledger");
  return <TrialBalanceScreen />;
}
