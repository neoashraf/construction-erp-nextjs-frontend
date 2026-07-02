import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "Salary sheets" screen (nav-tree route /hr/salary-sheets). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function HrSalarySheetsPage() {
  return <ComingSoon title="Salary sheets" />;
}
