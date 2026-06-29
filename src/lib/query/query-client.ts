import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

/**
 * One QueryClient with sane defaults (skill §7, ADR-0003 F3):
 *  - DON'T retry 4xx (client errors won't fix themselves) or any mutation,
 *  - reasonable staleTime so tenant/FY switches don't thrash,
 *  - errors flow as `ApiError` so screens render the standard error state.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    // Never retry 4xx; a couple of retries for 5xx / network (status 0).
    if (error.status >= 400 && error.status < 500) return false;
  }
  return failureCount < 2;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Mutations are not idempotent — never auto-retry.
        retry: false,
      },
    },
  });
}
