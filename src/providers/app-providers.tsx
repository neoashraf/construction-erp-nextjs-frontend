"use client";

import { type ReactNode } from "react";
import { QueryProvider } from "./query-provider";
import { SessionProvider } from "./session-provider";
import { CompanyFyProvider } from "./company-fy-provider";
import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { PointerEventsGuard } from "@/components/ui/pointer-events-guard";
import { type SafeUser } from "@/lib/auth/session";

/**
 * Composes the client-side providers (skill §7, ADR-0003 F3/F7): TanStack Query,
 * the session (safe user from the server), the active company/FY context, and the
 * theme. The `(app)` shell wraps its children in this with the server-read session.
 *
 * Ordering note: `CompanyFyProvider` reads `useQueryClient()` (its FY switch
 * invalidates queries — screen spec §9), so it MUST sit *inside* `QueryProvider`.
 */
export function AppProviders({ user, children }: { user: SafeUser | null; children: ReactNode }) {
  const inner = <ToastProvider>{children}</ToastProvider>;

  return (
    <ThemeProvider>
      <PointerEventsGuard />
      <QueryProvider>
        <SessionProvider user={user}>
          {user ? (
            <CompanyFyProvider
              initial={{ companyId: user.companyId, financialYearId: user.financialYearId }}
            >
              {inner}
            </CompanyFyProvider>
          ) : (
            inner
          )}
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
