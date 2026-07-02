import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "Vouchers" screen (nav-tree route /contra-journal/vouchers). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function ContraJournalVouchersPage() {
  return <ComingSoon title="Vouchers" />;
}
