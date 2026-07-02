import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "Opening balances" screen (nav-tree route /contra-journal/opening). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function ContraJournalOpeningPage() {
  return <ComingSoon title="Opening balances" />;
}
