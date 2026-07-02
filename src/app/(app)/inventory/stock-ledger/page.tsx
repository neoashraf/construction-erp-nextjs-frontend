import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "Stock ledger" screen (nav-tree route /inventory/stock-ledger). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function InventoryStockLedgerPage() {
  return <ComingSoon title="Stock ledger" />;
}
