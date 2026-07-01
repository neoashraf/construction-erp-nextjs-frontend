"use client";

import { useEffect, useState } from "react";

/**
 * True while the viewport matches the given `min-width` media query. Used only
 * to pick which diff-detail presentation to mount (side Sheet at >=1024 vs an
 * inline full-width block at >=768,<1024 — screen spec §4) since Tailwind
 * classes alone can't conditionally mount/unmount a component, only show/hide
 * its rendered output. Defaults to `false` during SSR/first paint (desktop-first
 * layout still renders correctly either way; this only toggles which detail
 * container is used once the client hydrates).
 */
export function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [px]);

  return matches;
}
