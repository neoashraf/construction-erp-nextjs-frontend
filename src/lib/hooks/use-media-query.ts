"use client";

import { useEffect, useState } from "react";

/**
 * Reactive CSS media-query hook. SSR-safe: starts `false` on the server and first client
 * render (so hydration matches), then resolves on mount and tracks changes. Use it when a
 * component must branch on the viewport in JS — e.g. mounting a mobile-only overlay whose
 * presence (not just visibility) must differ from desktop, since a `display:none` Radix
 * dialog still locks the page. For pure show/hide, prefer Tailwind breakpoint classes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** True below the `lg` breakpoint (1024px) — the site-facing phone/tablet layout. */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
