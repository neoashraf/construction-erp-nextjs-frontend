"use client";

import { useMemo } from "react";
import { ClipboardCheck, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { useOnline } from "@/lib/hooks/use-online";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { canReviewRequisitions } from "../access";
import { useRequisitions } from "../hooks/useRequisitions";
import { useProjectOptions, useUserOptions } from "../hooks/useRequisitionOptions";
import { RequisitionList, type ReqNameMaps } from "./RequisitionList";

/**
 * Requisition approvals worklist (spec §3 route-reconciliation; nav `requisitions.approvals`).
 * The shared requisition list pre-filtered to `status=SUBMITTED` — the review queue whose rows
 * open the decision detail at `/requisitions/approvals/[id]`. Reuses `useRequisitions` +
 * `RequisitionList` (no bespoke list UI). Non-approver roles get the permission-denied view;
 * the server scopes project-restricted readers to their assigned projects regardless.
 */
export function ApprovalsWorklistScreen() {
  const user = useAuthenticatedUser();
  const online = useOnline();

  const query = useRequisitions({ status: "SUBMITTED", page: 1 }, canReviewRequisitions(user));
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

  if (!canReviewRequisitions(user)) {
    return (
      <div className="mx-auto max-w-6xl">
        <Breadcrumb
          items={[{ label: "Requisitions", href: "/requisitions" }, { label: "Approvals" }]}
        />
        <Alert
          tone="destructive"
          className="mt-4"
          title="You don't have permission to review requisitions."
          data-testid="req-approvals-403"
        />
      </div>
    );
  }

  const total = query.data?.total ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[{ label: "Requisitions", href: "/requisitions" }, { label: "Approvals" }]}
      />
      <div className="mb-4 mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[23px] font-bold tracking-[-0.02em]" data-testid="req-approvals-title">
          Approvals
        </h1>
        {query.data && (
          <span className="inline-flex h-[23px] items-center gap-1.5 rounded-pill bg-muted px-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            <span className="text-[11.5px] font-semibold text-muted-foreground">
              {total} awaiting review
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
          <div className="flex flex-col gap-2 p-4" data-testid="req-approvals-loading">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Alert tone="destructive" title="Couldn't load the approvals queue. Please try again.">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => query.refetch()} data-testid="req-approvals-retry">
                  Retry
                </Button>
              </div>
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8" data-testid="req-approvals-empty">
            <EmptyState
              icon={ClipboardCheck}
              title="Nothing awaiting your approval."
              description="Submitted requisitions that need a decision will appear here."
            />
          </div>
        ) : (
          <RequisitionList rows={rows} maps={maps} basePath="/requisitions/approvals" />
        )}
      </Card>
    </div>
  );
}
