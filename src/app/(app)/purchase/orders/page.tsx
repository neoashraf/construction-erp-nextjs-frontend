import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "Purchase orders" screen (nav-tree route /purchase/orders). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function PurchaseOrdersPage() {
  return <ComingSoon title="Purchase orders" />;
}
