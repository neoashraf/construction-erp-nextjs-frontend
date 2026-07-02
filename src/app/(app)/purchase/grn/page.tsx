import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "GRN & matching" screen (nav-tree route /purchase/grn). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function PurchaseGrnPage() {
  return <ComingSoon title="GRN & matching" />;
}
