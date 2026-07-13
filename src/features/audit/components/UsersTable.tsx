"use client";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { formatDate } from "@/lib/format";
import { userRoleLabel, type UserListItem } from "../types";

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Inactive
    </Badge>
  );
}

/** Role badge — name + a "Custom" tag when the role resolves to a non-system role (BE #43). */
function RoleCell({ user }: { user: UserListItem }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone="info">{userRoleLabel(user.role)}</Badge>
      {!user.roleIsSystem && (
        <Badge tone="neutral" data-testid={`role-custom-tag-${user.id}`}>
          Custom
        </Badge>
      )}
    </span>
  );
}

function ProjectsCell({ user }: { user: UserListItem }) {
  // Keyed on the payload's roleIsUnscoped (BE #43), not a role-name heuristic.
  if (user.roleIsUnscoped) {
    return (
      <Badge tone="accent" className="whitespace-nowrap" data-testid={`scope-all-${user.id}`}>
        All projects
      </Badge>
    );
  }
  const count = user.assignedProjectCount;
  return (
    <span className="text-[12.5px] font-medium text-muted-foreground" data-testid={`scope-count-${user.id}`}>
      {count} {count === 1 ? "project" : "projects"}
    </span>
  );
}

function LastLoginCell({ value }: { value: string | null }) {
  return (
    <span className="font-mono text-[13px] text-muted-foreground">
      {value ? formatDate(value) : "Never"}
    </span>
  );
}

function RowActions({
  user,
  onEdit,
  onResetPassword,
  onToggleActive,
}: {
  user: UserListItem;
  onEdit: (u: UserListItem) => void;
  onResetPassword: (u: UserListItem) => void;
  onToggleActive: (u: UserListItem) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${user.name}`}
        data-testid={`user-actions-${user.id}`}
        className="grid h-7 w-7 place-items-center rounded-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => onEdit(user)} data-testid={`user-edit-${user.id}`}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onResetPassword(user)}
          data-testid={`user-reset-${user.id}`}
        >
          Reset password
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onToggleActive(user)}
          data-testid={`user-toggle-${user.id}`}
          className={user.isActive ? "text-destructive-ink" : "text-success-ink"}
        >
          {user.isActive ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Users table (spec §4/§5). Desktop ≥1024 full table; ≥768 drops last-login into
 * the detail panel (handled by the caller hiding the column); ≥360 stacked cards.
 * Never renders `password_hash` or any secret — `UserListItem` has no such field.
 */
export function UsersTable({
  users,
  onEdit,
  onResetPassword,
  onToggleActive,
  onOpenDetail,
  showLastLoginColumn = true,
  canManage = true,
}: {
  users: UserListItem[];
  onEdit: (u: UserListItem) => void;
  onResetPassword: (u: UserListItem) => void;
  onToggleActive: (u: UserListItem) => void;
  onOpenDetail: (u: UserListItem) => void;
  showLastLoginColumn?: boolean;
  /** Row actions (edit / reset / activate) need the UPDATE grant; hidden without it. */
  canManage?: boolean;
}) {

  console.log('users=> ',users)
  return (
    <div>
      {/* Desktop / tablet (≥768px) */}
      <div className="hidden md:block" data-testid="users-desktop">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {showLastLoginColumn && <TableHead>Last login</TableHead>}
              <TableHead>Projects</TableHead>
              <TableHead className="w-14 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((u) => (
              <TableRow
                key={u.id}
                tabIndex={0}
                data-testid={`user-row-${u.id}`}
                className="cursor-pointer focus-visible:bg-accent-soft focus-visible:outline-none"
                onClick={() => onOpenDetail(u)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpenDetail(u);
                }}
              >
                <TableCell>
                  <span className="block max-w-[280px] truncate font-semibold text-accent-ink">
                    {u.name}
                  </span>
                  <span className="mt-0.5 block max-w-[280px] truncate font-mono text-[11.5px] text-faint">
                    {u.email}
                  </span>
                </TableCell>
                <TableCell>
                  <RoleCell user={u} />
                </TableCell>
                <TableCell>
                  <StatusBadge active={u.isActive} />
                </TableCell>
                {showLastLoginColumn && (
                  <TableCell>
                    <LastLoginCell value={u.lastLoginAt} />
                  </TableCell>
                )}
                <TableCell>
                  <ProjectsCell user={u} />
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end">
                    {canManage && (
                      <RowActions
                        user={u}
                        onEdit={onEdit}
                        onResetPassword={onResetPassword}
                        onToggleActive={onToggleActive}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile stacked cards (≤767px, ≥360) — read-only review (spec §4) */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="users-cards">
        {users?.map((u) => (
          <li
            key={u.id}
            className="rounded-card border border-border bg-surface p-3"
            data-testid={`user-card-${u.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenDetail(u)}
                  className="truncate text-left font-semibold text-accent-ink hover:underline"
                >
                  {u.name}
                </button>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <RoleCell user={u} />
                  <StatusBadge active={u.isActive} />
                </div>
              </div>
              {canManage && (
                <RowActions
                  user={u}
                  onEdit={onEdit}
                  onResetPassword={onResetPassword}
                  onToggleActive={onToggleActive}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
