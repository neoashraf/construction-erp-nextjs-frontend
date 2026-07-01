"use client";

import { AlertTriangle, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { type ProjectOption } from "../types";

export interface AssignedRow {
  projectId: string;
  /** The resolved project name, or null when the project can no longer be resolved (spec §6 partial). */
  name: string | null;
}

/**
 * The assigned-projects list pane (spec §5/§6) — loading skeleton, error+retry,
 * empty (scoped, none), partial (id fallback + refresh hint), and the row list
 * with per-row "Remove {project}" (spec §10 a11y). Rows resolve `projectName`
 * from the current picker pool when the assignment payload only carries the id.
 */
export function AssignedProjectsList({
  status,
  rows,
  disabled,
  onRemove,
  onFocusPicker,
  onRetry,
  projectPool,
}: {
  status: "loading" | "error" | "ready";
  rows: AssignedRow[];
  disabled: boolean;
  onRemove: (projectId: string) => void;
  onFocusPicker: () => void;
  onRetry: () => void;
  projectPool: ProjectOption[];
}) {
  return (
    <Card className="flex min-w-0 flex-col" data-testid="assigned-projects-list">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-bold text-foreground">Assigned projects</span>
          <span className="font-variant-numeric text-xs font-semibold text-faint">
            {rows.length}
          </span>
        </div>
        <span className="text-[11px] text-faint">Click Remove to drop a project</span>
      </div>

      <div className="flex-none border-b border-border bg-surface-2 px-4 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        <strong className="font-semibold text-foreground">Replace-set:</strong> Save overwrites the
        user&rsquo;s entire project set with the list below — it isn&rsquo;t an append. Last write
        wins.
      </div>

      {status === "loading" && (
        <div data-testid="assigned-list-loading">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="mt-1.5 h-2.5 w-20" />
              </div>
              <Skeleton className="h-[18px] w-16" />
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="p-6">
          <Alert
            tone="destructive"
            title="Couldn't load assigned projects."
            data-testid="assigned-list-error"
          >
            <div className="flex flex-col items-start gap-2">
              <span>Check your connection and try again.</span>
              <Button size="sm" onClick={onRetry} data-testid="assigned-list-retry">
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {status === "ready" && rows.length === 0 && (
        <div className="p-6" data-testid="assigned-list-empty">
          <EmptyState
            icon={AlertTriangle}
            title="No projects assigned. This user can't transact yet."
            description="A project-scoped user with no assignments is blocked from every project. Pick one or more from the list on the right."
            action={
              <Button size="sm" onClick={onFocusPicker} data-testid="empty-add-projects">
                <Plus className="h-4 w-4" aria-hidden />
                Add projects
              </Button>
            }
          />
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="overflow-auto">
          {rows.map((row) => {
            const resolved =
              row.name ?? projectPool.find((p) => p.id === row.projectId)?.name ?? null;
            const missing = !resolved;
            const label = resolved ?? row.projectId;
            return (
              <div
                key={row.projectId}
                className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-surface-2"
                data-testid={`assigned-row-${row.projectId}`}
              >
                <span
                  className={`h-2 w-2 flex-none rounded-full ${missing ? "bg-warning" : "bg-accent"}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {missing ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-mono text-[13.5px] font-semibold text-foreground">
                          {row.projectId}
                        </span>
                        <span className="flex-none rounded-token bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-warning-ink">
                          NAME UNAVAILABLE
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-warning-ink">
                        That project no longer exists in this company.{" "}
                        <button
                          type="button"
                          className="font-semibold text-info-ink underline-offset-2 hover:underline"
                          data-testid={`refresh-hint-${row.projectId}`}
                          onClick={onFocusPicker}
                        >
                          Refresh
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div
                        className="truncate whitespace-normal break-words text-[13.5px] font-semibold text-foreground"
                        title={resolved}
                      >
                        {resolved}
                      </div>
                      <div className="truncate font-mono text-[11px] text-faint">
                        {row.projectId}
                      </div>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-none border-destructive-soft text-destructive-ink hover:bg-destructive-soft"
                  disabled={disabled}
                  onClick={() => onRemove(row.projectId)}
                  aria-label={`Remove ${label}`}
                  data-testid={`remove-${row.projectId}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
