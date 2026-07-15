"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useMasterLookups } from "@/lib/masters/lookups";
import { useAssignments } from "../hooks/useAssignments";

/**
 * Append-only assignment history (FR-HR-002; spec §6; Employees.dc.html detail mockup —
 * vertical timeline with connecting dots, newest first). NO edit/delete affordance on any
 * row. Every employee has ≥1 row from creation, so the loaded state is never blank — the
 * state matrix is loading · error+retry · populated. The newest row (first, per API
 * contract's newest-first order) carries a "Current" badge; the row whose effective date
 * matches the employee's joining date carries a "Joining assignment" badge. Project names
 * come from the shared master-lookups slice and fall back to a truncated id when the
 * lookup degrades.
 */
export function AssignmentHistory({
  employeeId,
  joiningDate,
}: {
  employeeId: string;
  /** `YYYY-MM-DD` — marks the row with this effective date as the "Joining assignment". */
  joiningDate?: string;
}) {
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
    <div>
      <div className="flex items-center gap-2.5 border-b border-border px-1 pb-3.5">
        <span className="text-[13px] font-semibold text-foreground">Assignment history</span>
        <span className="inline-flex h-[21px] items-center gap-1.5 rounded-pill bg-accent-soft px-2.5 text-[10.5px] font-semibold text-accent-ink">
          Append-only
        </span>
        <span className="ml-auto text-[12px] text-faint">Newest first · entries are never edited or removed</span>
      </div>
      <ol className="flex flex-col px-1 pt-1.5" data-testid="assignments-list">
        {rows.map((r, i) => {
          const isCurrent = i === 0;
          const isJoining = !!joiningDate && r.effectiveDate === joiningDate;
          const isLast = i === rows.length - 1;
          return (
            <li key={r.id} className="flex gap-3.5 pt-3.5" data-testid={`assignment-row-${r.id}`}>
              <div className="flex w-[22px] flex-none flex-col items-center">
                <span
                  className={cn(
                    "mt-1 h-2.5 w-2.5 flex-none rounded-full border-2",
                    isCurrent ? "border-accent bg-accent-soft" : "border-border-strong bg-surface",
                  )}
                  aria-hidden
                />
                {!isLast && <span className="mt-1 w-px flex-1 bg-border" aria-hidden />}
              </div>
              <div className={cn("min-w-0 flex-1 pb-3.5", !isLast && "border-b border-border")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                    {formatDate(r.effectiveDate)}
                  </span>
                  <span className="text-faint">→</span>
                  <span className="text-[13.5px] font-semibold text-foreground [overflow-wrap:anywhere]">
                    {projName(r.projectId)}
                  </span>
                  {isCurrent && (
                    <span className="inline-flex h-[19px] items-center rounded-pill bg-accent-soft px-2 text-[10.5px] font-semibold text-accent-ink">
                      Current
                    </span>
                  )}
                  {isJoining && (
                    <span className="inline-flex h-[19px] items-center rounded-pill bg-muted px-2 text-[10.5px] font-semibold text-muted-foreground">
                      Joining assignment
                    </span>
                  )}
                </div>
                {r.note && (
                  <div className="mt-1 text-[12.5px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                    {r.note}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 px-1 text-[12px] text-faint">
        Reassign adds a new entry here — the prior assignment is kept, never overwritten (FR-HR-002).
      </p>
    </div>
  );
}
