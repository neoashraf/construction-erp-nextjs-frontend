import { ListOrdered, BookOpenText, Scale } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guard-module-page";
import { ModuleIndex, type ModuleIndexEntry } from "@/components/shell/module-index";

const ENTRIES: ModuleIndexEntry[] = [
  { href: "/ledger/journal-entries", title: "Journal entries", description: "Posted entry headers with filters and totals.", icon: ListOrdered },
  { href: "/ledger/account-ledger", title: "Account ledger", description: "Chronological lines per account with running balance.", icon: BookOpenText },
  { href: "/ledger/trial-balance", title: "Trial balance", description: "Aggregated debit/credit/net per account, balance proof.", icon: Scale },
];

/** Ledger (LED) segment landing page — links to the module's built screens. */
export default async function LedgerPage() {
  await requireModuleAccess("ledger");
  return <ModuleIndex module="ledger" entries={ENTRIES} />;
}
