import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "Over-budget alerts" screen (nav-tree route /cost-control/alerts). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function CostControlAlertsPage() {
  return <ComingSoon title="Over-budget alerts" />;
}
