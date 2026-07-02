"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Client-only shell chrome UI state (screen spec §4/§9; ADR-0003 F7 — local UI state
 * is React context, not a global store). Holds the sidebar **collapse** flag
 * (persisted per user in `localStorage`) and the mobile **drawer** open flag. Nav
 * expand/collapse (accordion) is local to the sidebar itself.
 */

const COLLAPSE_KEY = "ze.shell.sidebarCollapsed";

interface ShellChromeValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const ShellChromeContext = createContext<ShellChromeValue | undefined>(undefined);

export function ShellChromeProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hydrate the persisted collapse choice after mount (avoids SSR/localStorage skew).
  // NB: `window.localStorage` (not the bare global) — this is a non-secret UI pref;
  // the auth-token ban (ADR-0003 F5) is about tokens, never stored here.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      // localStorage unavailable (private mode / SSR) — default to expanded.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore persistence failures — the toggle still works for the session.
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, drawerOpen, setDrawerOpen }),
    [collapsed, toggleCollapsed, drawerOpen],
  );

  return <ShellChromeContext.Provider value={value}>{children}</ShellChromeContext.Provider>;
}

export function useShellChrome(): ShellChromeValue {
  const ctx = useContext(ShellChromeContext);
  if (!ctx) throw new Error("useShellChrome must be used within a ShellChromeProvider");
  return ctx;
}
