"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type SafeUser } from "@/lib/auth/session";

/**
 * Session context (skill §4/§7, ADR-0003 F7). The safe `user` is read on the
 * server (shell layout / /api/auth/me) and handed to this provider; client
 * components read `role` + project scope from here. Tokens are NEVER here — they
 * live only in httpOnly cookies.
 */
const SessionContext = createContext<SafeUser | null | undefined>(undefined);

export function SessionProvider({
  user,
  children,
}: {
  user: SafeUser | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** The current session user, or null if unauthenticated. */
export function useSession(): SafeUser | null {
  const ctx = useContext(SessionContext);
  if (ctx === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

/** The current user, asserting authentication (use inside the (app) shell). */
export function useAuthenticatedUser(): SafeUser {
  const user = useSession();
  if (!user) throw new Error("Expected an authenticated session");
  return user;
}
