"use client";

import { type ReactNode } from "react";
import { QueryProvider } from "./query-provider";
import { SessionProvider } from "./session-provider";
import { CompanyFyProvider } from "./company-fy-provider";
import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { type SafeUser } from "@/lib/auth/session";

/**
 * Composes the client-side providers (skill §7, ADR-0003 F3/F7): TanStack Query,
 * the session (safe user from the server), the active company/FY context, and the
 * theme. The `(app)` shell wraps its children in this with the server-read session.
 */
export function AppProviders({ user, children }: { user: SafeUser | null; children: ReactNode }) {
  const content = (
    <ThemeProvider>
      <QueryProvider>
        <SessionProvider user={user}>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </QueryProvider>
    </ThemeProvider>
  );

  if (user) {
    return (
      <CompanyFyProvider
        initial={{ companyId: user.companyId, financialYearId: user.financialYearId }}
      >
        {content}
      </CompanyFyProvider>
    );
  }
  return content;
}
