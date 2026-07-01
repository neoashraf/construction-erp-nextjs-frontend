import { type ReactNode } from "react";
import { QueryProvider } from "@/providers/query-provider";

/**
 * Public (auth) route group — NO app shell (skill §2.1). Hosts login and
 * change-password (no sidebar/topbar/company-FY). QueryProvider is mounted here
 * so auth-screen mutations (login, change-password) can use TanStack Query.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <main
        className="flex min-h-screen items-center justify-center bg-canvas p-6"
        data-testid="auth-layout"
      >
        {children}
      </main>
    </QueryProvider>
  );
}
