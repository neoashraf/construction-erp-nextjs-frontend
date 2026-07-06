"use client";

import { useMemo, useState } from "react";
import { Check, Minus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABEL,
  type PermissionCatalog,
  type PendingPermissionMap,
  type ProjectScope,
} from "../types";
import { cellKey, triStateFor, type TriState } from "../schemas/permission-diff";
import { ScopeControl } from "./ScopeControl";
import { ValueLimitInput } from "./ValueLimitInput";

/**
 * The Resource-Catalogue × action matrix (spec §3/§4/§5/§9/§10 · RBAC v2). Rows are
 * **resources** (screen/feature codes) grouped under collapsible module headers,
 * sourced ENTIRELY from `GET /api/permissions/catalog` (FR-AUD-035) — no hardcoded
 * list. A resource enables only the actions it declares (undeclared cells are
 * disabled). Module-header + per-resource **tri-state bulk toggles** grant/clear a
 * whole declared set (draft-only). On the built-in Admin role every revoke/narrow
 * control is disabled (anti-lockout, FR-AUD-034). Arrow keys move between cells;
 * Space toggles the focused cell (spec §10 keyboard data grid).
 */
export function PermissionMatrix({
  catalog,
  pending,
  isUnscopedRole,
  isAdminRole,
  roleApprovalLimit,
  isEmptyRole,
  disabled,
  onGrant,
  onRevoke,
  onScopeChange,
  onLimitChange,
  onBulkModule,
  onBulkResource,
}: {
  catalog: PermissionCatalog;
  pending: PendingPermissionMap;
  isUnscopedRole: boolean;
  /** The built-in Admin/superuser role — its grid is edited only upward (anti-lockout). */
  isAdminRole: boolean;
  roleApprovalLimit: string | null;
  isEmptyRole: boolean;
  disabled: boolean;
  onGrant: (resource: string, action: string) => void;
  onRevoke: (resource: string, action: string) => void;
  onScopeChange: (resource: string, action: string, scope: ProjectScope) => void;
  onLimitChange: (resource: string, action: string, value: string) => void;
  /** Bulk grant/clear every declared (resource, action) in a module (`grant` direction). */
  onBulkModule: (module: string, grant: boolean) => void;
  /** Bulk grant/clear all declared actions of one resource. */
  onBulkResource: (resource: string, grant: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Flat, ordered list of resource rows (for arrow-key navigation across groups).
  const rows = useMemo(
    () => catalog.modules.flatMap((m) => m.resources.map((r) => ({ module: m.module, ...r }))),
    [catalog],
  );

  const grantedCount = Object.values(pending).filter((v) => v !== null).length;
  const totalDeclared = rows.reduce((n, r) => n + r.actions.length, 0);

  function keysForModule(module: string): string[] {
    return catalog.modules
      .filter((m) => m.module === module)
      .flatMap((m) => m.resources)
      .flatMap((r) => r.actions.map((a) => cellKey(r.resource, a)));
  }
  function keysForResource(resource: string): string[] {
    return rows.filter((r) => r.resource === resource).flatMap((r) => r.actions.map((a) => cellKey(resource, a)));
  }

  function cellId(resource: string, action: string): string {
    return `perm-cell-${resource}-${action}`;
  }

  function onCellClick(resource: string, action: string, declared: boolean) {
    if (disabled || !declared) return;
    const key = cellKey(resource, action);
    const granted = pending[key];
    if (!granted) {
      onGrant(resource, action);
      setSelected(key);
    } else {
      // Anti-lockout: on Admin a granted cell can't be revoked/narrowed — just toggle the editor.
      setSelected((s) => (s === key ? null : key));
    }
  }

  function focusCell(rowIdx: number, colIdx: number) {
    const row = rows[rowIdx];
    const action = PERMISSION_ACTIONS[colIdx];
    if (!row || !action) return;
    document.getElementById(cellId(row.resource, action))?.focus();
  }

  function onCellKeyDown(e: React.KeyboardEvent, rowIdx: number, colIdx: number, resource: string, action: string, declared: boolean) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        focusCell(rowIdx, Math.min(PERMISSION_ACTIONS.length - 1, colIdx + 1));
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusCell(rowIdx, Math.max(0, colIdx - 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        focusCell(Math.min(rows.length - 1, rowIdx + 1), colIdx);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusCell(Math.max(0, rowIdx - 1), colIdx);
        break;
      case " ":
      case "Spacebar":
        e.preventDefault();
        onCellClick(resource, action, declared);
        break;
      default:
        break;
    }
  }

  // A bulk toggle in the CLEAR direction (checked/mixed→clear) is disabled on Admin.
  function bulkDisabled(state: TriState): boolean {
    if (disabled) return true;
    return isAdminRole && state !== "unchecked";
  }

  let flatRowIdx = -1;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-card border border-border bg-surface shadow-sm">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="text-[13.5px] font-bold text-foreground">Permission matrix</div>
        <div className="text-[11.5px] text-faint" data-testid="matrix-count">
          {grantedCount} / {totalDeclared} granted
        </div>
      </div>

      {isEmptyRole && (
        <div className="flex flex-none items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5" data-testid="matrix-empty-hint">
          <span className="text-info" aria-hidden>ⓘ</span>
          <span className="text-[12.5px] text-muted-foreground">This role has no permissions yet.</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto" data-testid="permission-matrix" role="grid" aria-label="Resource by action permission matrix">
        <div style={{ minWidth: 980 }}>
          {/* header row */}
          <div role="row" className="sticky top-0 z-[5] flex border-b border-border-strong bg-surface-2">
            <div className="sticky left-0 z-[6] flex h-[52px] w-[300px] flex-none items-center border-r border-border bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              Resource / Permission
            </div>
            {PERMISSION_ACTIONS.map((action) => (
              <div key={action} role="columnheader" className="flex h-[52px] w-[85px] flex-none items-center justify-center border-l border-border">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{PERMISSION_ACTION_LABEL[action]}</span>
              </div>
            ))}
          </div>

          {catalog.modules.map((mod) => {
            const modKeys = keysForModule(mod.module);
            const modState = triStateFor(modKeys, pending);
            const isCollapsed = collapsed.has(mod.module);
            return (
              <div key={mod.module} data-testid={`module-group-${mod.module}`}>
                {/* module group header + tri-state bulk toggle */}
                <div role="row" className="flex items-stretch border-b border-border bg-surface-2/60">
                  <div className="sticky left-0 z-[2] flex w-[300px] flex-none items-center gap-2 border-r border-border bg-surface-2 px-3 py-2">
                    <button
                      type="button"
                      aria-label={isCollapsed ? `Expand ${mod.label}` : `Collapse ${mod.label}`}
                      aria-expanded={!isCollapsed}
                      onClick={() =>
                        setCollapsed((c) => {
                          const next = new Set(c);
                          if (next.has(mod.module)) next.delete(mod.module);
                          else next.add(mod.module);
                          return next;
                        })
                      }
                      className="grid h-6 w-6 flex-none place-items-center rounded-token text-muted-foreground hover:bg-muted"
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", isCollapsed && "-rotate-90")} aria-hidden />
                    </button>
                    <TriStateBox
                      state={modState}
                      disabled={bulkDisabled(modState)}
                      accessibleName={modState === "checked" ? `Clear all in ${mod.label}` : `Grant all in ${mod.label}`}
                      testId={`bulk-module-${mod.module}`}
                      onClick={() => onBulkModule(mod.module, modState !== "checked")}
                    />
                    <span className="truncate text-[12px] font-bold uppercase tracking-wide text-foreground">{mod.label}</span>
                  </div>
                  <div className="flex flex-1 items-center" aria-hidden />
                </div>

                {!isCollapsed &&
                  mod.resources.map((res) => {
                    flatRowIdx += 1;
                    const rowIdx = flatRowIdx;
                    const resKeys = keysForResource(res.resource);
                    const resState = triStateFor(resKeys, pending);
                    const editingKey = selected && selected.startsWith(`${res.resource}|`) ? selected : null;
                    const editingAction = editingKey ? editingKey.slice(res.resource.length + 1) : null;
                    return (
                      <div key={res.resource}>
                        <div role="row" className="flex border-b border-border">
                          <div className="sticky left-0 z-[2] flex min-h-[52px] w-[300px] flex-none items-center gap-2 border-r border-border bg-surface px-3">
                            <TriStateBox
                              state={resState}
                              disabled={bulkDisabled(resState)}
                              accessibleName={`All actions — ${res.resource}`}
                              testId={`bulk-resource-${res.resource}`}
                              onClick={() => onBulkResource(res.resource, resState !== "checked")}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-[12.5px] font-semibold text-foreground" title={res.label}>{res.label}</div>
                              <div className="truncate font-mono text-[10px] text-faint" title={res.resource}>{res.resource}</div>
                            </div>
                          </div>

                          {PERMISSION_ACTIONS.map((action, colIdx) => {
                            const declared = res.actions.includes(action);
                            const key = cellKey(res.resource, action);
                            const cell = pending[key];
                            const granted = !!cell;
                            const isSelected = selected === key;
                            const accessibleName = `${res.resource} — ${action}`;
                            const scopeText = granted ? (isUnscopedRole ? "ALL" : cell.scope) : "";
                            const hasCustomLimit = granted && cell.valueLimit != null;
                            const cellDisabled = disabled || !declared;

                            if (!declared) {
                              return (
                                <div
                                  key={key}
                                  role="gridcell"
                                  aria-disabled="true"
                                  data-testid={`cell-${res.resource}-${action}`}
                                  data-declared="false"
                                  title={`${accessibleName} — not applicable`}
                                  className="flex min-h-[52px] w-[85px] flex-none items-center justify-center border-l border-border bg-muted/40"
                                >
                                  <span className="text-faint" aria-hidden>·</span>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={key}
                                id={cellId(res.resource, action)}
                                role="checkbox"
                                aria-checked={granted}
                                aria-label={accessibleName}
                                aria-disabled={cellDisabled || undefined}
                                title={`${accessibleName}${granted ? ` — granted (${scopeText})` : " — not granted"}`}
                                tabIndex={rowIdx === 0 && colIdx === 0 ? 0 : -1}
                                data-testid={`cell-${res.resource}-${action}`}
                                data-declared="true"
                                onClick={() => onCellClick(res.resource, action, declared)}
                                onKeyDown={(e) => onCellKeyDown(e, rowIdx, colIdx, res.resource, action, declared)}
                                className={cn(
                                  "flex min-h-[52px] w-[85px] flex-none cursor-pointer flex-col items-center justify-center gap-1 border-l border-border outline-none focus-visible:ring-2 focus-visible:ring-accent",
                                  granted ? (isSelected ? "bg-accent-soft/80" : "bg-accent-soft/40") : isSelected ? "bg-muted" : "bg-background",
                                  cellDisabled && "pointer-events-none opacity-60",
                                )}
                              >
                                {granted ? (
                                  <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-primary text-primary-foreground">
                                    <Check className="h-3 w-3" aria-hidden />
                                  </span>
                                ) : (
                                  <span className="h-5 w-5 rounded-sm border-[1.5px] border-border-strong bg-background" />
                                )}
                                {granted && (
                                  <span className="text-[9px] font-bold tracking-wide text-accent-ink">
                                    {scopeText}
                                    {hasCustomLimit ? " ·৳" : ""}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {editingKey && editingAction && (
                          <PermissionEditorRow
                            resource={res.resource}
                            resourceLabel={res.label}
                            action={editingAction}
                            cell={pending[editingKey] ?? { scope: isUnscopedRole ? "ALL" : "ASSIGNED", valueLimit: null }}
                            isUnscopedRole={isUnscopedRole}
                            isAdminRole={isAdminRole}
                            roleApprovalLimit={roleApprovalLimit}
                            onScopeChange={(scope) => onScopeChange(res.resource, editingAction, scope)}
                            onLimitChange={(value) => onLimitChange(res.resource, editingAction, value)}
                            onRevoke={() => {
                              onRevoke(res.resource, editingAction);
                              setSelected(null);
                            }}
                            onDone={() => setSelected(null)}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A tri-state bulk checkbox (`aria-checked` true|false|mixed; spec §10). */
function TriStateBox({
  state,
  disabled,
  accessibleName,
  testId,
  onClick,
}: {
  state: TriState;
  disabled: boolean;
  accessibleName: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "mixed" ? "mixed" : state === "checked"}
      aria-label={accessibleName}
      title={accessibleName}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "grid h-[18px] w-[18px] flex-none place-items-center rounded-sm border-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        state === "checked" ? "border-primary bg-primary text-primary-foreground" : state === "mixed" ? "border-primary bg-primary/20 text-primary" : "border-border-strong bg-background",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      {state === "checked" && <Check className="h-3 w-3" aria-hidden />}
      {state === "mixed" && <Minus className="h-3 w-3" aria-hidden />}
    </button>
  );
}

function PermissionEditorRow({
  resource,
  resourceLabel,
  action,
  cell,
  isUnscopedRole,
  isAdminRole,
  roleApprovalLimit,
  onScopeChange,
  onLimitChange,
  onRevoke,
  onDone,
}: {
  resource: string;
  resourceLabel: string;
  action: string;
  cell: { scope: ProjectScope; valueLimit: string | null };
  isUnscopedRole: boolean;
  isAdminRole: boolean;
  roleApprovalLimit: string | null;
  onScopeChange: (scope: ProjectScope) => void;
  onLimitChange: (value: string) => void;
  onRevoke: () => void;
  onDone: () => void;
}) {
  const key = cellKey(resource, action);
  return (
    <div className="sticky left-0 flex flex-wrap items-center gap-5 border-b border-border-strong bg-surface-2 px-4 py-3.5" data-testid={`editor-row-${resource}-${action}`}>
      <div className="flex flex-none items-center gap-2">
        <span className="rounded-token bg-muted px-2 py-1 font-mono text-[11px] font-semibold text-foreground">
          {resource} · {PERMISSION_ACTION_LABEL[action as keyof typeof PERMISSION_ACTION_LABEL] ?? action}
        </span>
        <span className="text-[12.5px] text-muted-foreground">{resourceLabel}</span>
      </div>

      <ScopeControl value={isUnscopedRole ? "ALL" : cell.scope} isUnscopedRole={isUnscopedRole} onChange={onScopeChange} />

      <ValueLimitInput
        cellKey={key}
        value={cell.valueLimit ?? ""}
        roleApprovalLimit={roleApprovalLimit}
        isUnscopedRole={isUnscopedRole}
        disabled={isAdminRole}
        onChange={onLimitChange}
      />

      <div className="ml-auto flex flex-none gap-2">
        {isAdminRole ? (
          <span className="self-center text-[11.5px] italic text-muted-foreground" data-testid={`admin-locked-${resource}-${action}`}>
            The Admin role must keep full access.
          </span>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onRevoke} data-testid={`revoke-${resource}-${action}`}>
            Revoke
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onDone} data-testid={`done-${resource}-${action}`}>
          Done
        </Button>
      </div>
    </div>
  );
}
