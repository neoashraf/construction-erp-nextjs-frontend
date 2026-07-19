"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/errors";
import { roleLabel } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { ScopeSelector } from "./ScopeSelector";
import { TileGrid } from "./TileGrid";
import { useDashboard } from "../hooks/useDashboard";
import { type DashboardScope } from "../types";

/**
 * FE-61 `/dashboard` — the post-login landing. One `GET /api/dashboard` per
 * scope, rendering the returned role-scoped tile array in catalog order.
 * Scope selector re-issues; per-tile refresh swaps in-place; whole-page
 * error is retryable without losing the scope; scope violations (403 on
 * unassigned project) revert the selector to "All my projects".
 */
export function DashboardScreen() {
  const online = useOnline();
  const user = useAuthenticatedUser();
  const [scope, setScope] = useState<DashboardScope>({
    financialYearId: user.financialYearId ?? "",
    projectId: null,
  });
  // The last scope that actually succeeded — we snap back to it on a 403
  // (spec §13 "scope violation").
  const [committedScope, setCommittedScope] = useState<DashboardScope>({
    financialYearId: user.financialYearId ?? "",
    projectId: null,
  });

  const query = useDashboard(scope);

  const err = query.error ? asApiError(query.error) : null;
  const scopeViolation = err?.status === 403 && !!scope.projectId;

  // On a scope violation, snap the selector back to committedScope + surface
  // a one-time inline alert. The user then re-picks.
  const effectiveScope = scopeViolation ? committedScope : scope;

  // Once a query succeeds, remember it as the "known-good" scope.
  useMemo(() => {
    if (query.isSuccess) setCommittedScope(scope);
  }, [query.isSuccess, scope]);

  function onScopeChange(next: DashboardScope) {
    setScope(next);
  }

  const tileCount = query.data?.length ?? 0;

  return (
    <div className="mx-auto max-w-[1400px]" data-testid="dashboard">
      {/* content header — Dashboard is the shell root, so no breadcrumb */}
      <div className="flex items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="dashboard-title">
          Dashboard
        </h1>
        <span className="inline-flex h-[23px] items-center whitespace-nowrap rounded-pill bg-accent-soft px-2.5 text-[11.5px] font-semibold text-accent-ink">
          {roleLabel(user.role)}
        </span>
        <div className="flex-1" />
        {query.data && (
          <span className="whitespace-nowrap text-[12px] text-faint" data-testid="dashboard-tile-count">
            {tileCount} {tileCount === 1 ? "tile" : "tiles"}
          </span>
        )}
      </div>

      {/* scope selector row — re-fetches on change (no Apply) */}
      <ScopeSelector
        value={effectiveScope}
        onChange={(next) => {
          if (scopeViolation) {
            setScope(next);
            setCommittedScope(next);
          } else {
            onScopeChange(next);
          }
        }}
        disabled={query.isFetching && !scopeViolation}
      />

      <div className="mt-[18px]">
        {!online && (
          <Alert
            tone="warning"
            title="You're offline. Showing values as of last load."
            className="mb-4"
            data-testid="dashboard-offline"
          >
            <span className="text-[12.5px]">
              <WifiOff className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              Refresh is disabled until you reconnect.
            </span>
          </Alert>
        )}

        {scopeViolation && (
          <Alert
            tone="destructive"
            title="You don't have access to this project."
            className="mb-4"
            data-testid="dashboard-scope-violation"
          >
            <span className="text-[12.5px]">
              Project selector reverted to <b>All my projects</b>.
            </span>
          </Alert>
        )}

        {query.isFetching && !query.data && <DashboardSkeleton />}

        {query.isError && !scopeViolation && (
          <Alert
            tone="destructive"
            title="Couldn't load your dashboard."
            data-testid="dashboard-error"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px]">
                The scope selector above stays usable — change scope or retry.
              </span>
              <Button
                variant="destructive-outline"
                size="sm"
                className="h-[34px] flex-none"
                onClick={() => query.refetch()}
                data-testid="dashboard-retry"
              >
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {query.data && query.data.length === 0 && (
          <div data-testid="dashboard-empty">
            <EmptyState
              icon={LayoutGrid}
              title="No dashboard tiles are available for your role yet."
              description="Contact your administrator."
            />
          </div>
        )}

        {query.data && query.data.length > 0 && (
          <TileGrid tiles={query.data} scope={effectiveScope} stale={!online} />
        )}
      </div>
    </div>
  );
}

/** Loading skeletons — six tiles, the last spanning full width, matching the design. */
function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="dashboard-loading">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card
          key={i}
          className={cn(
            "flex min-h-[172px] flex-col gap-3.5 rounded-lg border-border p-4",
            i === 5 && "md:col-span-2 xl:col-span-3",
          )}
        >
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-[26px] w-[26px] rounded-md" />
            <Skeleton className="h-[11px] w-[44%]" />
          </div>
          <Skeleton className="h-[26px] w-[60%]" />
          <Skeleton className="h-[11px] w-[80%]" />
          <Skeleton className="h-[11px] w-[52%]" />
          <div className="flex-1" />
          <Skeleton className="h-[9px] w-[38%]" />
        </Card>
      ))}
    </div>
  );
}
