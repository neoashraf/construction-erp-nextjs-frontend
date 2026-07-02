import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "Budget vs actual" screen (nav-tree route /cost-control/budget-vs-actual). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function CostControlBudgetVsActualPage() {
  return <ComingSoon title="Budget vs actual" />;
}
