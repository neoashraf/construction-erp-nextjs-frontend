"use client";

import Link from "next/link";
import { Lock, MoreHorizontal, X } from "lucide-react";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { userRoleLabel } from "../types";
import { useUserDetail, useFinancialYearOptions } from "../hooks/use-users";

/**
 * User detail side panel (spec §3/§5; design file "Detail" state). Matches the mock:
 * an avatar + name + status header with a "⋯" actions menu (Edit / Reset password /
 * Activate|Deactivate), then labelled fields — Email, Role (name + BUILT-IN/CUSTOM
 * tag + scope-mode line), Financial year + Last login, Phone — and a Project scope
 * block (All-projects note for an unscoped role, a warning for zero assignments, or
 * the assigned-project list with a "Manage assignments →" link). A stale link 404s
 * as NOT_FOUND → "This user no longer exists." (spec §13, FR-AUD-027).
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

  // FY label (mock shows "FY 2025–26"); resolved from the company's FY options by the
  // user's financialYearId. Degrades to the id if options haven't loaded yet.
  const session = useAuthenticatedUser();
  const fyOptions = useFinancialYearOptions();
  const fyLabel =
    user &&
    (fyOptions.data?.find((o) => o.id === user.financialYearId)?.label ??
      (user.financialYearId === session.financialYearId ? "Current FY" : user.financialYearId));

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[412px]" data-testid="user-detail-panel">
        {/* ----- header ----- */}
        <div className="flex flex-none items-start justify-between gap-3 border-b border-border px-[22px] py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {query.isLoading || !user ? (
              <Skeleton className="h-10 w-10 flex-none rounded-full" />
            ) : (
              <span
                className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent-soft text-[14px] font-bold text-accent-ink"
                aria-hidden
              >
                {initialsOf(user.name)}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-base font-bold tracking-[-0.01em] text-foreground">
                {user?.name ?? "User detail"}
              </div>
              {user && (
                <span
                  className={cn(
                    "mt-1 inline-flex h-[21px] items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-semibold",
                    user.isActive
                      ? "bg-success-soft text-success-ink"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      user.isActive ? "bg-success" : "bg-muted-foreground",
                    )}
                    aria-hidden
                  />
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-none items-center gap-2">
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Actions"
                  data-testid="detail-actions"
                  className="grid h-8 w-8 place-items-center rounded-token border border-border-strong bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={onEdit} data-testid="detail-edit">
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onResetPassword} data-testid="detail-reset">
                    Reset password
                  </DropdownMenuItem>
                  <div className="mx-1.5 my-1 h-px bg-border" aria-hidden />
                  <DropdownMenuItem
                    onSelect={onToggleActive}
                    data-testid="detail-toggle-active"
                    className={user.isActive ? "text-destructive-ink" : "text-success-ink"}
                  >
                    {user.isActive ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <SheetClose
              aria-label="Close"
              className="grid h-8 w-8 flex-none place-items-center rounded-token border border-border-strong bg-surface text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </SheetClose>
          </div>
        </div>

        {/* ----- body ----- */}
        <div className="flex-1 overflow-auto px-[22px] pb-6 pt-[18px]">
          {query.isLoading ? (
            <div className="flex flex-col gap-4" data-testid="user-detail-loading">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          ) : query.isError || !user ? (
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
          ) : (
            <div className="flex flex-col gap-3.5">
              {user.mustChangePassword && (
                <div
                  className="mb-1 flex items-start gap-2.5 rounded-[9px] border border-info/30 bg-info-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-info-ink"
                  data-testid="must-change-password"
                >
                  <span aria-hidden className="mt-px flex-none">
                    ⓘ
                  </span>
                  <span>Temporary password — pending first-login change.</span>
                </div>
              )}

              <Field label="Email">
                <span className="break-all font-mono text-[13.5px] text-foreground">
                  {user.email}
                </span>
              </Field>

              <Field label="Role">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-foreground">
                    {userRoleLabel(user.role)}
                  </span>
                  <RoleKindTag isSystem={user.roleIsSystem} />
                </div>
                <div className="mt-1.5 text-[12px] text-muted-foreground">
                  {user.roleIsUnscoped
                    ? "Unscoped role — access to all projects"
                    : "Scoped role — limited to assigned projects"}
                </div>
              </Field>

              <div className="flex flex-wrap gap-x-[26px] gap-y-3.5">
                <Field label="Financial year">
                  <span className="font-mono text-[13.5px] text-foreground">{fyLabel}</span>
                </Field>
                <Field label="Last login">
                  <span
                    className={cn(
                      "font-mono text-[13.5px]",
                      user.lastLoginAt ? "text-foreground" : "text-faint",
                    )}
                  >
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </span>
                </Field>
              </div>

              <Field label="Phone">
                <span className="font-mono text-[13.5px] text-foreground">{user.phone ?? "—"}</span>
              </Field>

              <div className="my-0.5 h-px bg-surface-2" aria-hidden />

              {/* project scope */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
                    Project scope
                  </span>
                  {!user.roleIsUnscoped && (
                    <Link
                      href={`/audit/users/${userId}/projects`}
                      className="text-[12px] font-semibold text-accent-ink hover:underline"
                    >
                      Manage assignments →
                    </Link>
                  )}
                </div>

                {user.roleIsUnscoped ? (
                  <div
                    className="flex items-center gap-2 text-[13px] text-foreground"
                    data-testid="detail-scope-all"
                  >
                    <span className="h-[7px] w-[7px] flex-none rounded-full bg-accent" aria-hidden />
                    <span>All projects </span>
                    <span className="text-[12px] text-faint">
                      — unscoped role, no assignment needed
                    </span>
                  </div>
                ) : user.assignedProjects.length === 0 ? (
                  <div
                    className="flex items-start gap-2.5 rounded-[9px] border border-warning/30 bg-warning-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-warning-ink"
                    data-testid="user-detail-no-projects"
                  >
                    <span aria-hidden className="mt-px flex-none">
                      ⚠
                    </span>
                    <span>No projects assigned — this user can&rsquo;t transact yet.</span>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {user.assignedProjects.map((p) => (
                      <li
                        key={p.projectId}
                        className="flex h-9 items-center gap-2.5 rounded-token border border-border bg-surface-2 px-3 text-[13px] text-foreground"
                      >
                        <span
                          className="h-1.5 w-1.5 flex-none rounded-full bg-accent"
                          aria-hidden
                        />
                        {p.projectName}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A labelled field: uppercase micro-label (10.5px/600) over its value (design file). */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-faint">
        {label}
      </div>
      {children}
    </div>
  );
}

/** BUILT-IN / CUSTOM role-kind tag (design file — small squared badge next to the role). */
function RoleKindTag({ isSystem }: { isSystem: boolean }) {
  return (
    <span
      className={cn(
        "flex-none rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.3px]",
        isSystem ? "bg-info-soft text-info-ink" : "bg-muted text-muted-foreground",
      )}
    >
      {isSystem ? "Built-in" : "Custom"}
    </span>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
