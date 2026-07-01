"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { userRoleLabel, isUnscopedUserRole } from "../types";
import { useUserDetail } from "../hooks/use-users";

/**
 * User detail side panel (spec §3/§5) — role, assigned-project summary (link to
 * the separate project-assignment screen), status, last login, and the action
 * menu (Edit / Reset password / Activate|Deactivate). A stale link 404s as
 * NOT_FOUND → "This user no longer exists." (spec §13, FR-AUD-027).
 */
export function UserDetailPanel({
  userId,
  onClose,
  onEdit,
  onResetPassword,
  onToggleActive,
}: {
  userId: string;
  onClose: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
  onToggleActive: () => void;
}) {
  const query = useUserDetail(userId);
  const user = query.data;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[440px]" data-testid="user-detail-panel">
        <SheetHeader kicker="User" title={user?.name ?? "User detail"} />
        <SheetBody>
          {query.isLoading ? (
            <div className="flex flex-col gap-2" data-testid="user-detail-loading">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : query.isError ? (
            <EmptyState
              icon={Lock}
              title="This user no longer exists."
              description="It may have been removed, or belongs to a different company."
              action={
                <Button size="sm" variant="outline" onClick={onClose}>
                  Back to list
                </Button>
              }
            />
          ) : user ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="font-mono text-[12.5px] text-faint">{user.email}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge tone="info">{userRoleLabel(user.role)}</Badge>
                  {user.isActive ? (
                    <Badge tone="success" dot>
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <span>Last login</span>
                <span className="font-mono text-foreground">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <span>Phone</span>
                <span className="font-mono text-foreground">{user.phone ?? "—"}</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Assigned projects
                  </span>
                  <Link
                    href="/audit/project-assignment"
                    className="text-[12px] font-semibold text-accent-ink hover:underline"
                  >
                    Manage assignment →
                  </Link>
                </div>
                {isUnscopedUserRole(user.role) ? (
                  <Badge tone="accent" className="w-fit">
                    All projects
                  </Badge>
                ) : user.assignedProjects.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground" data-testid="user-detail-no-projects">
                    No projects assigned — this user can&rsquo;t transact yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {user.assignedProjects.map((p) => (
                      <li
                        key={p.projectId}
                        className="flex items-center gap-2 rounded-token border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground"
                      >
                        <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden />
                        {p.projectName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </SheetBody>
        {user && (
          <SheetFooter>
            <Button variant="outline" size="md" onClick={onResetPassword} data-testid="detail-reset">
              Reset password
            </Button>
            <Button
              variant={user.isActive ? "destructive" : "primary"}
              size="md"
              onClick={onToggleActive}
              data-testid="detail-toggle-active"
            >
              {user.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button size="md" onClick={onEdit} data-testid="detail-edit">
              Edit
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
