import { ComingSoon } from "@/components/shell/coming-soon";

/**
 * Placeholder route for the "IPC register & retention" screen (nav-tree route /sales/ipc-register). The real
 * screen ships with its per-screen brief; until then this renders the shared
 * ComingSoon placeholder so the nav item navigates to a real page, not a dead link.
 */
export default function SalesIpcRegisterPage() {
  return <ComingSoon title="IPC register & retention" />;
}
