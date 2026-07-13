"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useMasterLookups } from "@/lib/masters/lookups";
import { useAssignments } from "../hooks/useAssignments";

/**
 * Append-only assignment history (FR-HR-002; spec §6). Newest-first; NO edit/delete affordance
 * on any row. Every employee has ≥1 row from creation, so the loaded state is never blank —
 * the state matrix is loading · error+retry · populated. Project names come from the shared
 * master-lookups slice and fall back to a truncated id when the lookup degrades.
 */
export function AssignmentHistory({ employeeId }: { employeeId: string }) {
  const query = useAssignments(employeeId);
  const lookups = useMasterLookups();
  const projName = (id: string) => {
    const n = lookups.project(id);
    if (n === id) return `${id.slice(0, 8)} (project name unavailable)`;
    return n;
  };

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2" data-testid="assignments-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Alert tone="destructive" title="Couldn't load the assignment history.">
        <div className="flex flex-col items-start gap-2">
          <span>Check your connection and try again.</span>
          <Button size="sm" onClick={() => query.refetch()} data-testid="assignments-retry">
            Retry
          </Button>
        </div>
      </Alert>
    );
  }
  const rows = query.data ?? [];
  return (
    <ol className="flex flex-col gap-2" data-testid="assignments-list">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-card border border-border bg-surface px-4 py-3"
          data-testid={`assignment-row-${r.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground [overflow-wrap:anywhere]">
                {projName(r.projectId)}
              </div>
              {r.note && (
                <div className="mt-0.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                  {r.note}
                </div>
              )}
            </div>
            <div className="flex-none text-[12px] tabular-nums text-muted-foreground">
              {formatDate(r.effectiveDate)}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
