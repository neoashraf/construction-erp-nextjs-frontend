"use client";

import { useEffect, useState } from "react";

/**
 * Track the browser's online/offline status (spec §6 offline state). Shared by the CC
 * read screens so a live feed can warn when what it shows may be stale.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const set = () => setOnline(navigator.onLine);
    set();
    window.addEventListener("online", set);
    window.addEventListener("offline", set);
    return () => {
      window.removeEventListener("online", set);
      window.removeEventListener("offline", set);
    };
  }, []);
  return online;
}
