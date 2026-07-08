"use client";

import { useEffect, useState } from "react";
import { Lock, Users as UsersIcon, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { useSession } from "@/providers/session-provider";
import { hasGrant } from "@/lib/auth/roles";
import { useToast } from "@/components/ui/toast";
import { useUsersList, useUserDetail } from "../hooks/use-users";
import { UserFilters, type StatusFilter } from "./UserFilters";
import { UsersTable } from "./UsersTable";
import { UserDrawer } from "./UserDrawer";
import { UserDetailPanel } from "./UserDetailPanel";
import { UserStatusDialog } from "./UserStatusDialog";
import { UserResetPasswordDialog } from "./UserResetPasswordDialog";
import { type UserListItem } from "../types";

const PAGE_SIZE = 25;

type DrawerState = { kind: "create" } | { kind: "edit"; user: UserListItem } | null;
type StatusTarget = { user: UserListItem; mode: "deactivate" | "activate" } | null;

/**
 * Users admin screen (FR-AUD-002/007/008/009/011/018/019/020/027; spec). Admin-
 * only — a non-Admin who reaches the URL sees the inline 403 view (spec §11); the
 * nav item is also hidden for them by the module route guard, and the server
 * re-checks every request. Full state matrix per spec §6.
 */
export function UsersScreen() {
  const session = useSession();
  const { toast } = useToast();
  // Permission-driven (FE-21): the users READ grant admits — Admin always has it, and
  // a custom role granted `audit.users:READ` also gets in. Falls back to Admin-only
  // when the session has no permission projection. Backend re-checks every call.
  const canRead = session ? hasGrant(session, "audit.users", "READ") : false;
  // Creating a user needs the CREATE grant — hide the "New user" affordances without it
  // (a READ-only viewer can list users but not add one). Backend re-checks on POST.
  const canCreate = session ? hasGrant(session, "audit.users", "CREATE") : false;
  // Editing / resetting / (de)activating a user needs the UPDATE grant — hide the row
  // actions without it. Backend re-checks on each PATCH.
  const canManage = session ? hasGrant(session, "audit.users", "UPDATE") : false;

  const [role, setRole] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusTarget, setStatusTarget] = useState<StatusTarget>(null);
  const [resetTarget, setResetTarget] = useState<UserListItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPage(1), [role, status, debouncedQ]);

  const query = useUsersList(
    {
      role: role === "all" ? undefined : role,
      isActive: status === "all" ? undefined : status === "active",
      search: debouncedQ || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    canRead,
  );

  // A viewer without the users READ grant who reaches the URL sees the 403 view.
  if (!canRead) {
    return (
      <div className="mx-auto max-w-3xl" data-testid="users-forbidden">
        <Breadcrumb />
        <Card className="mt-4 p-10">
          <EmptyState
            icon={Lock}
            title="You don't have access to user management."
            description="User management is restricted to Admins. If you believe this is a mistake, ask an administrator to review your role."
          />
        </Card>
      </div>
    );
  }

  const hasFilters = role !== "all" || status !== "all" || debouncedQ !== "";
  const rows = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function clearFilters() {
    setRole("all");
    setStatus("all");
    setQ("");
  }

  function askToggle(user: UserListItem) {
    setStatusTarget({ user, mode: user.isActive ? "deactivate" : "activate" });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Breadcrumb />
          <h1 className="text-[23px] font-bold tracking-[-0.02em]">Users</h1>
        </div>
        {canCreate && (
          <Button size="md" onClick={() => setDrawer({ kind: "create" })} data-testid="new-user">
            <Plus className="h-4 w-4" aria-hidden />
            New user
          </Button>
        )}
      </div>

      <div className="mt-4">
        <UserFilters role={role} onRole={setRole} status={status} onStatus={setStatus} q={q} onQ={setQ} />
      </div>

      <Card className="mt-3.5 overflow-hidden p-3 sm:p-4">
        {query.isLoading ? (
          <div className="flex flex-col gap-2" data-testid="users-loading">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert tone="destructive" title="Couldn't load users.">
            <div className="flex flex-col items-start gap-2">
              <span>Check your connection and try again.</span>
              <Button size="sm" onClick={() => query.refetch()} data-testid="users-retry">
                Retry
              </Button>
            </div>
          </Alert>
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={UsersIcon}
              title="No users match these filters."
              action={
                <Button size="md" variant="outline" onClick={clearFilters} data-testid="clear-filters">
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={UsersIcon}
              title="No users yet."
              description="Add the first user so your team can sign in to Zakir Enterprise."
              action={
                canCreate ? (
                  <Button size="md" onClick={() => setDrawer({ kind: "create" })} data-testid="empty-new-user">
                    <Plus className="h-4 w-4" aria-hidden />
                    New user
                  </Button>
                ) : undefined
              }
            />
          )
        ) : (
          <>
            <UsersTable
              users={rows}
              canManage={canManage}
              onEdit={(u) => setDrawer({ kind: "edit", user: u })}
              onResetPassword={setResetTarget}
              onToggleActive={askToggle}
              onOpenDetail={(u) => setDetailId(u.id)}
            />
            <div className="mt-3 flex items-center justify-between border-t border-border px-1 pt-3">
              <span className="text-[12.5px] text-muted-foreground">
                Showing {rows.length} of {total} users
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-[12.5px] tabular-nums text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {drawer?.kind === "create" && (
        <UserDrawer
          mode={{ kind: "create" }}
          onClose={() => setDrawer(null)}
          onSaved={(message) => {
            setDrawer(null);
            toast(message, "success");
          }}
          onReloadRequested={() => query.refetch()}
        />
      )}

      {drawer?.kind === "edit" && (
        <EditDrawerBridge
          userId={drawer.user.id}
          onClose={() => setDrawer(null)}
          onSaved={(message) => {
            setDrawer(null);
            toast(message, "success");
          }}
          onReloadRequested={() => query.refetch()}
        />
      )}

      {detailId && (
        <UserDetailPanel
          userId={detailId}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            const u = rows.find((r) => r.id === detailId);
            if (u) setDrawer({ kind: "edit", user: u });
            setDetailId(null);
          }}
          onResetPassword={() => {
            const u = rows.find((r) => r.id === detailId);
            if (u) setResetTarget(u);
          }}
          onToggleActive={() => {
            const u = rows.find((r) => r.id === detailId);
            if (u) askToggle(u);
            setDetailId(null);
          }}
        />
      )}

      <UserStatusDialog
        user={statusTarget?.user ?? null}
        mode={statusTarget?.mode ?? "deactivate"}
        onClose={() => setStatusTarget(null)}
      />

      <UserResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
    </div>
  );
}

/** Loads the full detail (with `version`) before handing off to the edit drawer form. */
function EditDrawerBridge({
  userId,
  onClose,
  onSaved,
  onReloadRequested,
}: {
  userId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onReloadRequested: () => void;
}) {
  const detail = useUserDetail(userId);
  if (detail.isLoading || !detail.data) return null;
  return (
    <UserDrawer
      mode={{ kind: "edit", user: detail.data }}
      onClose={onClose}
      onSaved={onSaved}
      onReloadRequested={onReloadRequested}
    />
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5 text-xs text-muted-foreground">
      Admin <span className="text-border-strong">/</span> <span className="font-medium text-foreground">Users</span>
    </nav>
  );
}
