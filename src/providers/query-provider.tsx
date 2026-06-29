"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query/query-client";

/**
 * Provides the app-wide QueryClient (skill §7). One client per browser session;
 * created lazily in state so it survives re-renders but isn't shared across
 * requests on the server.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
