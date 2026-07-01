"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { useRoles, useRole } from "../hooks/use-roles";
import { useSaveRolePermissions } from "../hooks/use-save-role-permissions";
import {
  baseMapFromRole,
  hasPendingChanges,
  changedCellCount,
  buildPermissionDiff,
} from "../schemas/permission-diff";
import { mapRolePermissionError } from "../schemas/role-permissions";
import { normaliseLimit } from "../schemas/role-permissions";
import { ROLE_NAME_LABEL, type PendingPermissionMap, type ProjectScope } from "../types";
import { RoleSelector } from "./RoleSelector";
import { ApprovalLimitInput } from "./ApprovalLimitInput";
import { PermissionMatrix } from "./PermissionMatrix";
import { SaveBar } from "./SaveBar";
import { ConflictBanner } from "./ConflictBanner";
import { RolesForbiddenView } from "./RolesForbiddenView";
import { RolesMobileSummary } from "./RolesMobileSummary";
import { DiscardPermissionChangesDialog } from "./DiscardPermissionChangesDialog";

/**
 * The Roles & permissions editor (spec — full screen). Admin-only (FR-AUD-011);
 * a role selector drives a loaded `RoleDetail`, whose grants seed a local
 * pending-edit map (spec §9 batch model). Every toggle/scope/limit/approval-limit
 * change stays local until "Save changes" fires the diffed batch mutation.
 */
export function RolePermissionEditorScreen() {
  const session = useSession();
  const isAdmin = session?.role === "ADMIN";
  const { toast } = useToast();

  const rolesQuery = useRoles(isAdmin);
  const [roleId, setRoleId] = useState<string | null>(null);

  useEffect(() => {
    const firstId = rolesQuery.data?.[0]?.id;
    if (!roleId && firstId) {
      setRoleId(firstId);
    }
  }, [roleId, rolesQuery.data]);

  const roleQuery = useRole(isAdmin ? roleId : null);
  const saveMutation = useSaveRolePermissions();

  const [work, setWork] = useState<PendingPermissionMap>({});
  const [approvalLimit, setApprovalLimit] = useState("");
  const [conflict, setConflict] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Seed local working state whenever a (new) role loads.
  useEffect(() => {
    if (roleQuery.data) {
      setWork(baseMapFromRole(roleQuery.data));
      setApprovalLimit(roleQuery.data.approvalLimit ?? "");
      setConflict(false);
    }
  }, [roleQuery.data]);

  if (!isAdmin) {
    return <RolesForbiddenView />;
  }

  const role = roleQuery.data;
  const base = role ? baseMapFromRole(role) : {};
  const dirty = role
    ? hasPendingChanges(base, work, role.approvalLimit, normaliseLimit(approvalLimit))
    : false;
  const changeCount = role
    ? changedCellCount(base, work) +
      (String(role.approvalLimit ?? "") !== normaliseLimit(approvalLimit) ? 1 : 0)
    : 0;
  const isEmptyRole =
    Object.values(work).every((v) => v === null) && Object.keys(work).length === 0;

  function selectRole(id: string) {
    setRoleId(id);
  }

  function grant(module: string, action: string) {
    const isUnscoped = !!role?.isUnscoped;
    setWork((w) => ({
      ...w,
      [`${module}|${action}`]: { scope: isUnscoped ? "ALL" : "ASSIGNED", valueLimit: null },
    }));
  }

  function revoke(module: string, action: string) {
    setWork((w) => ({ ...w, [`${module}|${action}`]: null }));
  }

  function setScope(module: string, action: string, scope: ProjectScope) {
    if (role?.isUnscoped) return;
    setWork((w) => {
      const key = `${module}|${action}`;
      const current = w[key];
      if (!current) return w;
      return { ...w, [key]: { ...current, scope } };
    });
  }

  function setLimit(module: string, action: string, value: string) {
    setWork((w) => {
      const key = `${module}|${action}`;
      const current = w[key];
      if (!current) return w;
      return { ...w, [key]: { ...current, valueLimit: normaliseLimit(value) } };
    });
  }

  function discard() {
    if (role) {
      setWork(baseMapFromRole(role));
      setApprovalLimit(role.approvalLimit ?? "");
    }
    setDiscardOpen(false);
  }

  function askDiscard() {
    if (!dirty || saveMutation.isPending) return;
    setDiscardOpen(true);
  }

  async function save() {
    if (!role || !dirty || saveMutation.isPending) return;
    setConflict(false);
    const diff = buildPermissionDiff(role, work, normaliseLimit(approvalLimit));
    try {
      await saveMutation.mutateAsync({ role, diff });
      toast("Permissions saved.", "success");
    } catch (err) {
      const e = asApiError(err);
      const mapped = mapRolePermissionError(e);
      if (mapped.kind === "optimisticLockConflict") {
        setConflict(true);
      } else if (mapped.kind === "roleScopeConflict") {
        toast(mapped.message, "error");
      } else if (mapped.kind === "offline") {
        toast(mapped.message, "error");
      } else if (mapped.kind === "forbidden") {
        toast(mapped.message, "error");
      } else {
        toast(mapped.message, "error");
      }
    }
  }

  function reload() {
    setConflict(false);
    roleQuery.refetch();
    // Pending edits are intentionally NOT cleared here — the Admin re-applies
    // them against the refreshed version (spec §6/§9: never a silent overwrite).
  }

  const roleName = role
    ? (ROLE_NAME_LABEL[role.name as keyof typeof ROLE_NAME_LABEL] ?? role.name)
    : "";

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <Breadcrumb roleName={roleName} />

      <div className="mt-1.5 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground">
          Roles &amp; permissions
        </h1>
        <Badge tone="neutral" className="h-7">
          Fixed roles · not creatable
        </Badge>
      </div>

      {conflict && (
        <div className="mt-3.5">
          <ConflictBanner onReload={reload} />
        </div>
      )}

      {rolesQuery.isError && (
        <Alert tone="destructive" title="Couldn't load this role." className="mt-4">
          <div className="flex flex-col items-start gap-2">
            <span>Check your connection and try again.</span>
            <Button size="sm" onClick={() => rolesQuery.refetch()} data-testid="roles-retry">
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {rolesQuery.isLoading && <LoadingSkeleton />}

      {!rolesQuery.isLoading && !rolesQuery.isError && rolesQuery.data && (
        <>
          {/* Desktop/tablet editor (spec §4: >=768; below 1024 editing is unsupported per §4 mobile note,
              but the tablet breakpoint still shows the (scrollable) matrix — only <1024 hides editing
              affordances at the true mobile width via RolesMobileSummary below `lg`). */}
          <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
            <RoleSelector roles={rolesQuery.data} selectedId={roleId} onSelect={selectRole} />

            {roleQuery.isLoading && <LoadingSkeleton />}

            {roleQuery.isError && (
              <Alert tone="destructive" title="Couldn't load this role." className="mt-3.5">
                <div className="flex flex-col items-start gap-2">
                  <span>Check your connection and try again.</span>
                  <Button size="sm" onClick={() => roleQuery.refetch()} data-testid="role-retry">
                    Retry
                  </Button>
                </div>
              </Alert>
            )}

            {role && !roleQuery.isLoading && !roleQuery.isError && (
              <>
                <Card className="mt-3.5 flex-none">
                  <div className="border-b border-border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold text-foreground">{roleName}</span>
                      {role.isUnscoped && (
                        <Badge tone="accent" dot data-testid="unscoped-badge">
                          Unscoped · all projects
                        </Badge>
                      )}
                      <span className="font-mono text-[11px] text-faint" data-testid="role-version">
                        v{role.version}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded-token bg-muted px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-muted-foreground">
                        {role.permissions.length} of {16 * 8} permissions granted
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-6 p-4">
                    <div className="min-w-[280px] flex-1" />
                    <ApprovalLimitInput value={approvalLimit} onChange={setApprovalLimit} />
                  </div>
                </Card>

                <div className="mt-3.5 flex min-h-0 flex-1 flex-col">
                  <PermissionMatrix
                    pending={work}
                    isUnscopedRole={role.isUnscoped}
                    roleApprovalLimit={role.approvalLimit}
                    isEmptyRole={isEmptyRole}
                    disabled={saveMutation.isPending}
                    onGrant={grant}
                    onRevoke={revoke}
                    onScopeChange={setScope}
                    onLimitChange={setLimit}
                  />
                  <SaveBar
                    dirty={dirty}
                    saving={saveMutation.isPending}
                    changeCount={changeCount}
                    roleVersion={role.version}
                    onSave={save}
                    onDiscard={askDiscard}
                  />
                </div>
              </>
            )}
          </div>

          {/* Mobile read-only summary (spec §4 <1024 — editing not supported). */}
          {role && (
            <div className="lg:hidden">
              <RoleSelector roles={rolesQuery.data} selectedId={roleId} onSelect={selectRole} />
              <RolesMobileSummary
                roleName={roleName}
                approvalLimit={role.approvalLimit}
                pending={work}
              />
            </div>
          )}
        </>
      )}

      <DiscardPermissionChangesDialog
        open={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={discard}
      />
    </div>
  );
}

function Breadcrumb({ roleName }: { roleName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      Admin <span className="text-border-strong">/</span> Roles{" "}
      <span className="text-border-strong">/</span>{" "}
      <span className="font-medium text-foreground">{roleName || "…"}</span>
    </nav>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-3.5" data-testid="roles-loading">
      <Card className="p-4">
        <Skeleton className="h-3 w-28" />
        <div className="mt-3 flex gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-[34px] w-[120px]" />
          ))}
        </div>
        <div className="mt-4 flex gap-6 border-t border-border pt-4">
          <Skeleton className="h-3.5 w-[300px]" />
          <Skeleton className="ml-auto h-9 w-[300px]" />
        </div>
      </Card>
      <Card className="mt-3.5 overflow-hidden p-0">
        <Skeleton className="h-[52px] w-full rounded-none" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 border-b border-border px-4"
            style={{ height: 54 }}
          >
            <Skeleton className="h-3 w-40" />
            <div className="ml-8 flex gap-7">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                <Skeleton key={j} className="h-5 w-5" />
              ))}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
