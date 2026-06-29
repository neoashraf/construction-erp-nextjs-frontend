import { type ReactNode } from "react";

/**
 * Public (auth) route group — NO app shell (skill §2.1). Hosts the auth-flow
 * plumbing (login, later change-password). The designed login screen is a later
 * per-screen brief; this group ships the plumbing only.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6" data-testid="auth-layout">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
