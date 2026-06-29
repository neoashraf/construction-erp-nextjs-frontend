import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { getServerSession } from "@/lib/auth/server-session";
import { guardAuthenticated, LOGIN_PATH } from "@/lib/auth/guard";
import { AppProviders } from "@/providers/app-providers";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Authenticated (app) group layout = the role-based app shell (skill §2.1/§5,
 * ADR-0003 F1/F5). It:
 *  - reads the session on the server,
 *  - redirects an unauthenticated visitor to login (route guard),
 *  - mounts the client providers (Query, session, company/FY, theme),
 *  - renders the shell (sidebar/topbar) driven by the session role.
 * NO screens here — module segments are empty placeholders until their briefs.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getServerSession();
  const decision = guardAuthenticated(user?.role);
  if (!decision.allow) {
    redirect(decision.redirectTo ?? LOGIN_PATH);
  }
  // decision.allow === true implies a user is present.
  return (
    <AppProviders user={user}>
      <AppShell>{children}</AppShell>
    </AppProviders>
  );
}
