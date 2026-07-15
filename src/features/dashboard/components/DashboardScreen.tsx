"use client";

import { useMemo, useState } from "react";
import { Ban, LayoutGrid, WifiOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { asApiError } from "@/lib/api/errors";
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

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6" data-testid="dashboard">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="dashboard-title">
            Dashboard
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Read-only overview — every tile links to the report that owns it.
          </p>
        </div>
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
      </div>

      {!online && (
        <Alert
          tone="warning"
          title="You're offline. Last-loaded values are shown, dimmed."
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
            The scope has been reset. Choose a project you&rsquo;re assigned to.
          </span>
        </Alert>
      )}

      {query.isFetching && !query.data && <DashboardSkeleton />}

      {query.isError && !scopeViolation && (
        <Card className="p-8" data-testid="dashboard-error">
          <EmptyState
            icon={LayoutGrid}
            title="Couldn't load your dashboard."
            description="Your scope is preserved — try again."
            action={
              <Button size="md" onClick={() => query.refetch()} data-testid="dashboard-retry">
                Retry
              </Button>
            }
          />
        </Card>
      )}

      {query.data && query.data.length === 0 && (
        <Card className="p-10" data-testid="dashboard-empty">
          <EmptyState
            icon={Ban}
            title="No dashboard tiles are available for your role yet."
            description="Contact your administrator."
          />
        </Card>
      )}

      {query.data && query.data.length > 0 && (
        <TileGrid tiles={query.data} scope={effectiveScope} stale={!online} />
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      data-testid="dashboard-loading"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-token" />
            <div className="flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-1 h-2 w-32" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
}
