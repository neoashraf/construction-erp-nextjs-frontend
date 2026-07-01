import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { AccountLedgerScreen } from "@/features/ledger/components/AccountLedgerScreen";

/**
 * Account ledger + dimension drill-down route (LED; FR-LED-031/006/012/030/007) —
 * under the (app) shell + the `ledger` module guard. Read-only. Accepts an inbound
 * `accountId` + `dateFrom`/`dateTo` scope (e.g. from a Trial-balance drill) via search
 * params so the drill lands pre-scoped; the server further restricts a Project Manager
 * to assigned-project lines and re-checks every read (`403 FORBIDDEN`).
 */
export default async function AccountLedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleAccess("ledger");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return (
    <AccountLedgerScreen
      initialFilter={{
        accountId: one(sp.accountId),
        dateFrom: one(sp.dateFrom),
        dateTo: one(sp.dateTo),
      }}
    />
  );
}
