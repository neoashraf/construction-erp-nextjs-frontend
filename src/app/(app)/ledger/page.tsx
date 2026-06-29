import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModulePlaceholder } from "@/components/shell/module-placeholder";

/** Ledger (LED) segment — guarded, empty. Screens come with their briefs. */
export default async function LedgerPage() {
  await requireModuleAccess("ledger");
  return <ModulePlaceholder module="ledger" />;
}
