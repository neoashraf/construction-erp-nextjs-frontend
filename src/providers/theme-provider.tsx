"use client";

import { createContext, useContext, useState, useMemo, useEffect, type ReactNode } from "react";

/**
 * Theme context (skill §7, ADR-0003 F7). Light/dark applied as a `data-theme`
 * attribute on <html>; the real palette is token-driven (styles/tokens.css —
 * placeholder TODO until the design-system phase).
 */
export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  initial = "light",
  children,
}: {
  initial?: Theme;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
