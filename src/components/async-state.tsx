"use client";

import { type ReactNode } from "react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";

/**
 * Renders the standard async state matrix (skill §8/§10, overview NFRs): loading /
 * empty / error(+retry) / success. Every async region in a screen wraps its
 * content in this so the states are handled consistently. The error branch shows
 * a typed `ApiError` message and a retry affordance.
 */
export interface AsyncStateProps<T> {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  /** Treat this loaded value as "empty" (renders the empty branch). */
  isEmpty?: (data: T) => boolean;
  onRetry?: () => void;
  loading?: ReactNode;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

export function AsyncState<T>({
  isLoading,
  error,
  data,
  isEmpty,
  onRetry,
  loading,
  empty,
  children,
}: AsyncStateProps<T>) {
  if (isLoading) {
    return <div role="status" aria-live="polite">{loading ?? "Loading…"}</div>;
  }
  if (error) {
    const message = error instanceof ApiError ? error.message : "Something went wrong";
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p>{message}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }
  if (data === undefined) {
    return <div role="status">{empty ?? "No data"}</div>;
  }
  if (isEmpty?.(data)) {
    return <div role="status">{empty ?? "Nothing here yet"}</div>;
  }
  return <>{children(data)}</>;
}
