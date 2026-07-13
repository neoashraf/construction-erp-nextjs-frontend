"use client";

import { useMemo } from "react";
import { PackageOpen, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canViewIssues } from "../access";
import { useRequisitions } from "../hooks/useRequisitions";
import { useProjectOptions, useUserOptions } from "../hooks/useRequisitionOptions";
import { RequisitionList, type ReqNameMaps } from "./RequisitionList";

/**
 * Requisition issues worklist (spec §3 route-reconciliation; nav `requisitions.issues`). The
 * shared requisition list pre-filtered to `status=APPROVED,PARTIALLY_ISSUED` — the fulfilment
 * queue whose rows open the issue detail at `/requisitions/issues/[id]`. Reuses `useRequisitions`
 * + `RequisitionList`. Non-viewers get the permission-denied view; the server scopes
 * project-restricted readers to their assigned projects.
 */
export function IssuesWorklistScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();

  const query = useRequisitions(
    { status: "APPROVED,PARTIALLY_ISSUED", page: 1 },
    canViewIssues(user),
  );
  const rows = query.data?.data ?? [];

  const projectsData = useProjectOptions().data;
  const usersData = useUserOptions().data;

  const maps: ReqNameMaps = useMemo(
    () => ({
      projects: new Map((projectsData ?? []).map((p) => [p.id, p])),
      users: new Map((usersData ?? []).map((u) => [u.id, u])),
    }),
    [projectsData, usersData],
  );

  if (!canViewIssues(user)) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb
          items={[{ label: "Requisitions", href: "/requisitions" }, { label: "Issues" }]}
        />
        <Alert
          tone="destructive"
          className="mt-4"
          title="You don't have permission to view requisition issues."
          data-testid="req-issues-403"
        />
      </div>
    );
  }

  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb items={[{ label: "Requisitions", href: "/requisitions" }, { label: "Issues" }]} />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="req-issues-title">
          Issues
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} to fulfil
            </span>
          </span>
        )}
      </div>

      {!online && (
        <Alert
          tone="warning"
          className="mb-3"
          title="You're offline. Showing the last loaded queue."
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            The queue refreshes when you reconnect.
          </span>
        </Alert>
      )}

      <Card
        className={cn(
          "flex flex-col overflow-hidden",
          query.isFetching && !query.isLoading && "opacity-60",
        )}
      >
        {query.isLoading ? (
          <div className="flex flex-col gap-2 p-4" data-testid="req-issues-loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load the issues queue. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="req-issues-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8" data-testid="req-issues-empty">
            <EmptyState
              icon={PackageOpen}
              title="Nothing to issue right now."
              description="Approved requisitions awaiting material issue will appear here."
            />
          </div>
        ) : (
          <RequisitionList rows={rows} maps={maps} basePath="/requisitions/issues" />
        )}
      </Card>
    </div>
  );
}
