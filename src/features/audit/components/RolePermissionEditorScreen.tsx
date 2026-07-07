"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/providers/session-provider";
import { useToast } from "@/components/ui/toast";
import { asApiError } from "@/lib/api/errors";
import { useRoles, useRole } from "../hooks/use-roles";
import { usePermissionCatalog } from "../hooks/use-permission-catalog";
import { useSaveRolePermissions } from "../hooks/use-save-role-permissions";
import { useCreateRole, useDeleteRole } from "../hooks/use-role-crud";
import {
  baseMapFromRole,
  hasPendingChanges,
  changedCellCount,
  buildReplacePayload,
  defaultCell,
  cellKey,
  narrows,
  limitedCellCount,
} from "../schemas/permission-diff";
import { mapRolePermissionError, normaliseLimit } from "../schemas/role-permissions";
import {
  ROLE_NAME_LABEL,
  type PendingPermissionMap,
  type ProjectScope,
  type RoleDetail,
  type RoleListItem,
} from "../types";
import { RolePicker } from "./RolePicker";
import { NewRoleDialog } from "./NewRoleDialog";
import { DeleteRoleDialog } from "./DeleteRoleDialog";
import { ApprovalLimitInput } from "./ApprovalLimitInput";
import { ScopeModeControl } from "./ScopeModeControl";
import { PermissionMatrix } from "./PermissionMatrix";
import { SaveBar } from "./SaveBar";
import { ConflictBanner } from "./ConflictBanner";
import { RolesForbiddenView } from "./RolesForbiddenView";
import { RolesMobileSummary } from "./RolesMobileSummary";
import { DiscardPermissionChangesDialog } from "./DiscardPermissionChangesDialog";
import { BulkClearWarningDialog } from "./BulkClearWarningDialog";

/**
 * Roles & permissions editor (RBAC v2 · FR-AUD-011/013/016/019/020/034/035). Admin
 * only. A role list (built-in + custom, with New role / Delete) drives a loaded
 * `RoleDetail`; the grid rows come EXCLUSIVELY from `GET /api/permissions/catalog`.
 * Every toggle/scope/limit/bulk edit stays local until "Save changes" commits the
 * whole grid in one atomic `PATCH /api/roles/:id/permissions` (with a role-meta
 * `PATCH` only if the approval limit changed). The built-in Admin grid is edited
 * only upward (anti-lockout).
 */
export function RolePermissionEditorScreen() {
  const session = useSession();
  const isAdmin = session?.role === "ADMIN";
  const { toast } = useToast();

  const rolesQuery = useRoles(isAdmin);
  const catalogQuery = usePermissionCatalog(isAdmin);
  const [roleId, setRoleId] = useState<string | null>(null);

  useEffect(() => {
    const firstId = rolesQuery.data?.[0]?.id;
    if (!roleId && firstId) setRoleId(firstId);
  }, [roleId, rolesQuery.data]);

  const roleQuery = useRole(isAdmin ? roleId : null);
  const saveMutation = useSaveRolePermissions();
  const createRole = useCreateRole();
  const deleteRole = useDeleteRole();

  const [work, setWork] = useState<PendingPermissionMap>({});
  const [approvalLimit, setApprovalLimit] = useState("");
  const [isUnscoped, setIsUnscoped] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [newRoleNameError, setNewRoleNameError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleListItem | null>(null);
  const [bulkClear, setBulkClear] = useState<{ keys: string[]; limited: number } | null>(null);

  const role = roleQuery.data;
  const isAdminRole = !!role?.isSystem && role?.name === "ADMIN";

  // Seed local working state whenever a (new) role loads.
  useEffect(() => {
    if (role) {
      setWork(baseMapFromRole(role));
      setApprovalLimit(role.approvalLimit ?? "");
      setIsUnscoped(role.isUnscoped);
      setConflict(false);
    }
  }, [role]);

  const catalog = catalogQuery.data;
  const base = useMemo(() => (role ? baseMapFromRole(role) : {}), [role]);

  if (!isAdmin) return <RolesForbiddenView />;

  const dirty = role
    ? hasPendingChanges(base, work, role.approvalLimit, normaliseLimit(approvalLimit)) ||
      isUnscoped !== role.isUnscoped
    : false;
  const changeCount = role
    ? changedCellCount(base, work) +
      (String(role.approvalLimit ?? "") !== normaliseLimit(approvalLimit) ? 1 : 0) +
      (isUnscoped !== role.isUnscoped ? 1 : 0)
    : 0;
  const isEmptyRole = role ? role.permissions.length === 0 && Object.values(work).every((v) => v === null) : false;
  const roleName = role ? (ROLE_NAME_LABEL[role.name as keyof typeof ROLE_NAME_LABEL] ?? role.name) : "";

  // Granted vs. total-declared count for the grid card header (matches the design file's
  // "N of M granted" copy). Draft-aware: counts the pending working set, not the saved grid.
  const grantedCount = Object.values(work).filter((v) => v !== null).length;
  const totalDeclared = catalog
    ? catalog.modules.reduce((n, m) => n + m.resources.reduce((k, r) => k + r.actions.length, 0), 0)
    : 0;
  const grantCountText = `${grantedCount} of ${totalDeclared} granted`;

  // ── grid edit handlers ──────────────────────────────────────────────────────
  function grant(resource: string, action: string) {
    setWork((w) => ({ ...w, [cellKey(resource, action)]: defaultCell(isUnscoped) }));
  }
  function revoke(resource: string, action: string) {
    // Anti-lockout: never revoke a catalogue-valid Admin grant (the control is disabled anyway).
    if (isAdminRole) return;
    setWork((w) => ({ ...w, [cellKey(resource, action)]: null }));
  }
  function setScope(resource: string, action: string, scope: ProjectScope) {
    if (isUnscoped) return;
    setWork((w) => {
      const key = cellKey(resource, action);
      const current = w[key];
      if (!current) return w;
      const next = { ...current, scope };
      if (isAdminRole && narrows(base[key] ?? current, next)) return w; // anti-lockout
      return { ...w, [key]: next };
    });
  }
  function setLimit(resource: string, action: string, value: string) {
    setWork((w) => {
      const key = cellKey(resource, action);
      const current = w[key];
      if (!current) return w;
      const next = { ...current, valueLimit: normaliseLimit(value) };
      if (isAdminRole && narrows(base[key] ?? current, next)) return w; // anti-lockout
      return { ...w, [key]: next };
    });
  }

  // Scope mode (spec §5 meta card "Scope mode" — editable for every role except the
  // built-in Admin, anti-lockout). Switching to "All projects" forces every pending
  // grant's project scope to ALL, mirroring the design's `setMode` cascade so the
  // grid never shows a stale ASSIGNED scope under an unscoped role.
  function setScopeMode(next: boolean) {
    if (isAdminRole) return;
    setIsUnscoped(next);
    if (next) {
      setWork((w) => {
        const out: PendingPermissionMap = {};
        for (const [key, cell] of Object.entries(w)) {
          out[key] = cell ? { ...cell, scope: "ALL" } : cell;
        }
        return out;
      });
    }
  }

  // ── bulk toggles (draft-only; spec §5/§9) ───────────────────────────────────
  function applyBulk(keys: string[], grantAll: boolean) {
    setWork((w) => {
      const next = { ...w };
      for (const key of keys) {
        next[key] = grantAll ? (w[key] ?? defaultCell(isUnscoped)) : null;
      }
      return next;
    });
  }
  function bulkKeys(fn: (k: string) => boolean): string[] {
    if (!catalog) return [];
    return catalog.modules
      .flatMap((m) => m.resources)
      .flatMap((r) => r.actions.map((a) => cellKey(r.resource, a)))
      .filter(fn);
  }
  function onBulkModule(module: string, grantAll: boolean) {
    const modResourceSet = new Set(
      (catalog?.modules.find((m) => m.module === module)?.resources ?? []).map((r) => r.resource),
    );
    const keys = bulkKeys((k) => modResourceSet.has(k.slice(0, k.lastIndexOf("|"))));
    handleBulk(keys, grantAll);
  }
  function onBulkResource(resource: string, grantAll: boolean) {
    const keys = bulkKeys((k) => k.slice(0, k.lastIndexOf("|")) === resource);
    handleBulk(keys, grantAll);
  }
  function handleBulk(keys: string[], grantAll: boolean) {
    if (!grantAll) {
      const limited = limitedCellCount(keys, work);
      if (limited > 0) {
        setBulkClear({ keys, limited });
        return;
      }
    }
    applyBulk(keys, grantAll);
  }

  // ── role list actions ───────────────────────────────────────────────────────
  function selectRole(id: string) {
    setRoleId(id);
  }
  function openNewRole() {
    setNewRoleNameError(null);
    setNewRoleOpen(true);
  }
  async function onCreateRole(input: Parameters<typeof createRole.mutateAsync>[0]) {
    setNewRoleNameError(null);
    try {
      const created = await createRole.mutateAsync(input);
      setNewRoleOpen(false);
      setRoleId(created.id);
      toast("Role created.", "success");
    } catch (err) {
      const mapped = mapRolePermissionError(asApiError(err));
      if (mapped.kind === "duplicateRoleName") setNewRoleNameError(mapped.message);
      else toast(mapped.message, "error");
    }
  }
  async function onConfirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRole.mutateAsync(deleteTarget.id);
      const fallback = rolesQuery.data?.find((r) => r.id !== deleteTarget.id)?.id ?? null;
      if (roleId === deleteTarget.id) setRoleId(fallback);
      setDeleteTarget(null);
      toast("Role deleted.", "success");
    } catch (err) {
      const mapped = mapRolePermissionError(asApiError(err));
      toast(mapped.message, "error");
      setDeleteTarget(null);
    }
  }

  // ── save / discard ──────────────────────────────────────────────────────────
  function discard() {
    if (role) {
      setWork(baseMapFromRole(role));
      setApprovalLimit(role.approvalLimit ?? "");
      setIsUnscoped(role.isUnscoped);
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
    const permissions = buildReplacePayload(work, isUnscoped);
    const approvalChanged = String(role.approvalLimit ?? "") !== normaliseLimit(approvalLimit);
    const scopeModeChanged = isUnscoped !== role.isUnscoped;
    try {
      await saveMutation.mutateAsync({
        role,
        permissions,
        ...(approvalChanged ? { approvalLimit: normaliseLimit(approvalLimit) } : {}),
        ...(scopeModeChanged ? { isUnscoped } : {}),
      });
      toast("Permissions saved.", "success");
    } catch (err) {
      const mapped = mapRolePermissionError(asApiError(err));
      if (mapped.kind === "optimisticLockConflict") setConflict(true);
      else toast(mapped.message, "error"); // scope-conflict / lockout / validation / offline / forbidden
    }
  }
  function reload() {
    setConflict(false);
    roleQuery.refetch();
    // Pending edits are intentionally preserved for re-entry (spec §6/§9).
  }

  const catalogError = catalogQuery.isError;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-none items-start justify-between gap-4">
        <div className="min-w-0">
          {roleName && (
            <div className="mb-1.5 text-[12px] text-muted-foreground">
              <span className="text-muted-foreground">Roles &amp; permissions</span>{" "}
              <span className="text-border-strong">›</span>{" "}
              <span className="font-medium text-foreground">{roleName}</span>
            </div>
          )}
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-foreground">Roles &amp; permissions</h1>
        </div>
        <Button onClick={openNewRole} data-testid="new-role-header" className="hidden flex-none lg:inline-flex">
          New role
        </Button>
      </div>

      {conflict && (
        <div className="mt-3.5">
          <ConflictBanner onReload={reload} />
        </div>
      )}

      {rolesQuery.isError && (
        <Alert tone="destructive" title="Couldn't load roles &amp; permissions." className="mt-4">
          <div className="flex flex-col items-start gap-2">
            <span>Check your connection and try again.</span>
            <Button size="sm" onClick={() => rolesQuery.refetch()} data-testid="roles-retry">Retry</Button>
          </div>
        </Alert>
      )}

      {(rolesQuery.isLoading || catalogQuery.isLoading) && !rolesQuery.isError && <LoadingSkeleton />}

      {!rolesQuery.isLoading && !rolesQuery.isError && rolesQuery.data && (
        // Full-width editor (design file · RBAC v2): the role picker lives in the meta
        // card, not a left column. Desktop/tablet (>=1024) shows the two-pane editor;
        // narrower widths fall back to the read-only summary.
        <div className="mt-3.5 flex min-h-0 min-w-0 flex-1 flex-col">
          {roleQuery.isLoading && <LoadingSkeleton />}

          {roleQuery.isError && (
            <Alert tone="destructive" title="Couldn't load this role." className="mt-1">
              <div className="flex flex-col items-start gap-2">
                <span>Check your connection and try again.</span>
                <Button size="sm" onClick={() => roleQuery.refetch()} data-testid="role-retry">Retry</Button>
              </div>
            </Alert>
          )}

          {catalogError && (
            <Alert tone="destructive" title="Couldn't load the permission catalogue." className="mt-1">
              <div className="flex flex-col items-start gap-2">
                <span>The grid can’t render without it.</span>
                <Button size="sm" onClick={() => catalogQuery.refetch()} data-testid="catalog-retry">Retry</Button>
              </div>
            </Alert>
          )}

          {role && catalog && !roleQuery.isLoading && !roleQuery.isError && (
            <>
              {/* Desktop/tablet editor (>=1024) */}
              <div className="hidden min-h-0 flex-1 flex-col lg:flex">
                {/* META CARD */}
                <Card className="flex-none p-4">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div className="min-w-[280px] flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <RolePicker
                          roles={rolesQuery.data}
                          selectedId={roleId}
                          onSelect={selectRole}
                          onNewRole={openNewRole}
                          onDeleteRole={setDeleteTarget}
                        />
                        {role.isSystem ? (
                          <Badge tone="neutral" data-testid="system-badge">System</Badge>
                        ) : (
                          <Badge tone="accent" data-testid="custom-badge">Custom</Badge>
                        )}
                        {isUnscoped && (
                          <Badge tone="accent" dot data-testid="unscoped-badge">
                            All projects
                          </Badge>
                        )}
                        <span className="font-mono text-[11px] text-faint" data-testid="role-version">
                          v{role.version}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[12.5px] text-muted-foreground" data-testid="role-usercount">
                        {role.userCount} user{role.userCount === 1 ? "" : "s"}
                        {isAdminRole && (
                          <>
                            {" · "}
                            <span className="text-faint" data-testid="admin-lockout-note">
                              The Admin role must keep full access.
                            </span>
                          </>
                        )}
                      </div>

                      <div className="mt-4">
                        <ScopeModeControl isUnscoped={isUnscoped} disabled={isAdminRole} onChange={setScopeMode} />
                      </div>
                    </div>

                    <ApprovalLimitInput value={approvalLimit} onChange={setApprovalLimit} />
                  </div>
                </Card>

                <div className="mt-3.5 flex min-h-0 flex-1 flex-col">
                  <PermissionMatrix
                    catalog={catalog}
                    pending={work}
                    isUnscopedRole={isUnscoped}
                    isAdminRole={isAdminRole}
                    isEmptyRole={isEmptyRole}
                    disabled={saveMutation.isPending}
                    grantCountText={grantCountText}
                    onGrant={grant}
                    onRevoke={revoke}
                    onScopeChange={setScope}
                    onLimitChange={setLimit}
                    onBulkModule={onBulkModule}
                    onBulkResource={onBulkResource}
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
              </div>

              {/* Mobile read-only summary (<1024) */}
              <div className="lg:hidden">
                <RolesMobileSummary
                  roleName={roleName}
                  approvalLimit={role.approvalLimit}
                  isUnscoped={role.isUnscoped}
                  catalog={catalog}
                  pending={work}
                />
              </div>
            </>
          )}
        </div>
      )}

      <NewRoleDialog
        open={newRoleOpen}
        submitting={createRole.isPending}
        nameError={newRoleNameError}
        onCancel={() => setNewRoleOpen(false)}
        onCreate={onCreateRole}
      />
      <DeleteRoleDialog
        role={deleteTarget}
        submitting={deleteRole.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={onConfirmDelete}
      />
      <DiscardPermissionChangesDialog open={discardOpen} onKeepEditing={() => setDiscardOpen(false)} onDiscard={discard} />
      <BulkClearWarningDialog
        open={!!bulkClear}
        count={bulkClear?.keys.length ?? 0}
        limited={bulkClear?.limited ?? 0}
        onKeep={() => setBulkClear(null)}
        onClear={() => {
          if (bulkClear) applyBulk(bulkClear.keys, false);
          setBulkClear(null);
        }}
      />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-3.5 flex-1" data-testid="roles-loading">
      <Card className="flex flex-wrap items-start justify-between gap-6 p-4">
        <div className="flex-1">
          <Skeleton className="h-10 w-[240px]" />
          <Skeleton className="mt-3 h-3 w-40" />
          <Skeleton className="mt-4 h-9 w-[220px]" />
        </div>
        <Skeleton className="h-[62px] w-[288px]" />
      </Card>
      <Card className="mt-3.5 overflow-hidden p-0">
        <Skeleton className="h-[46px] w-full rounded-none" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex items-center gap-3.5 border-b border-border px-4" style={{ height: 52 }}>
            <Skeleton className="h-3 w-48" />
            <div className="ml-8 flex gap-6">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((j) => (
                <Skeleton key={j} className="h-5 w-5" />
              ))}
            </div>
            <Skeleton className="ml-auto h-[26px] w-[150px]" />
          </div>
        ))}
      </Card>
    </div>
  );
}

export type { RoleDetail };
