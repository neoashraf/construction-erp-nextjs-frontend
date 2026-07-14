import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { getServerSession } from "@/lib/auth/server-session";
import { guardAuthenticated, LOGIN_PATH } from "@/lib/auth/guard";
import { AppProviders } from "@/providers/app-providers";

/**
 * Authenticated (print) group layout (skill §2.1). A parallel layout to `(app)` for
 * print-preview surfaces (Mushak 6.3 IPC document, later payment/receipt vouchers) —
 * carries the session + Query/Session providers but NOT the shell chrome (sidebar,
 * topbar, breadcrumb), so the print surface fills the browser window and prints without
 * hidden overlays. Auth still required — an unauthenticated visitor bounces to login.
 */
export default async function PrintLayout({ children }: { children: ReactNode }) {
  const user = await getServerSession();
  const decision = guardAuthenticated(user?.role);
  if (!decision.allow) {
    redirect(decision.redirectTo ?? LOGIN_PATH);
  }
  return <AppProviders user={user}>{children}</AppProviders>;
}
