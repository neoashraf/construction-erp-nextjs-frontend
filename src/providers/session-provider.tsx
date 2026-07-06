"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type SafeUser } from "@/lib/auth/session";
import { navigateToForcedChange } from "@/lib/auth/forced-change";

/**
 * Session context (skill §4/§7, ADR-0003 F7 · FE-21 FR-AUD-031/033). The safe
 * `user` is read on the server (cookie identity) and handed here as the initial
 * value; on mount the provider re-reads `GET /api/auth/me` — which the BFF now
 * proxies to the backend — enriching the session with the LIVE effective
 * permission set, project scope and `mustChangePassword`. `refreshSession()`
 * re-reads it on demand (e.g. after an FY switch) so Admin grant edits surface
 * without a client release (FR-AUD-033). Tokens are NEVER here — they live only
 * in httpOnly cookies.
 *
 * Forced change (FR-AUD-030): while `mustChangePassword` is true the provider
 * routes to `/change-password?forced=1` and keeps the user there until reset.
 */

interface SessionContextValue {
  user: SafeUser | null;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({
  user: initialUser,
  children,
}: {
  user: SafeUser | null;
  children: ReactNode;
}) {
  const [user, setUser] = useState<SafeUser | null>(initialUser);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) return; // degraded — keep the current (cookie) session
      const body = (await res.json()) as { user?: SafeUser };
      if (body.user) setUser(body.user);
    } catch {
      // Network failure — keep the current session (degraded role-map nav).
    }
  }, []);

  // Enrich the cookie identity with the live projection on app load (FR-AUD-031).
  useEffect(() => {
    if (initialUser) void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forced-change hold (FR-AUD-030, app-shell §13): route to change-password and
  // stay there until the reset clears the flag (the screen re-reads the session).
  useEffect(() => {
    if (user?.mustChangePassword) navigateToForcedChange();
  }, [user?.mustChangePassword]);

  const value = useMemo(() => ({ user, refreshSession }), [user, refreshSession]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}

/** The current session user, or null if unauthenticated. */
export function useSession(): SafeUser | null {
  return useSessionContext().user;
}

/** The current user, asserting authentication (use inside the (app) shell). */
export function useAuthenticatedUser(): SafeUser {
  const user = useSession();
  if (!user) throw new Error("Expected an authenticated session");
  return user;
}

const NOOP_REFRESH = async () => {};

/**
 * Re-read `GET /api/auth/me` (live grants/scope) — e.g. after an FY switch.
 * Safe outside a SessionProvider (no-ops) so chrome components render standalone
 * in tests without the provider.
 */
export function useSessionRefresh(): () => Promise<void> {
  const ctx = useContext(SessionContext);
  return ctx?.refreshSession ?? NOOP_REFRESH;
}
