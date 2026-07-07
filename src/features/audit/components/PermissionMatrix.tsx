"use client";

import { useMemo, useState } from "react";
import { Check, Minus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABEL,
  type PermissionCatalog,
  type PendingPermissionMap,
  type ProjectScope,
} from "../types";
import { cellKey, triStateFor, type TriState } from "../schemas/permission-diff";

/**
 * The Resource-Catalogue × action matrix (spec §3/§4/§5/§9/§10 · RBAC v2). Rows are
 * **resources** (screen/feature codes) grouped under collapsible module headers,
 * sourced ENTIRELY from `GET /api/permissions/catalog` (FR-AUD-035) — no hardcoded
 * list. A resource enables only the actions it declares (undeclared cells show a
 * disabled "N/A" dash). Module-header + per-resource **tri-state bulk toggles**
 * grant/clear a whole declared set (draft-only). Each granted resource row carries
 * its **project scope** (ALL/ASSIGNED) and **value limit** inline (design file · the
 * two trailing columns). On the built-in Admin role every revoke/narrow control is
 * disabled (anti-lockout, FR-AUD-034). Arrow keys move between action cells; Space
 * toggles the focused cell (spec §10 keyboard data grid).
 *
 * Column widths mirror the design file: 236px resource · 54px per action ·
 * 176px project scope · 156px value limit.
 */

const RESOURCE_W = 236;
const ACTION_W = 54;
const SCOPE_W = 176;
const LIMIT_W = 156;

export function PermissionMatrix({
  catalog,
  pending,
  isUnscopedRole,
  isAdminRole,
  isEmptyRole,
  disabled,
  grantCountText,
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
  isEmptyRole: boolean;
  disabled: boolean;
  /** Header count copy, e.g. "12 of 34 granted" — computed by the screen. */
  grantCountText: string;
  onGrant: (resource: string, action: string) => void;
  onRevoke: (resource: string, action: string) => void;
  onScopeChange: (resource: string, action: string, scope: ProjectScope) => void;
  onLimitChange: (resource: string, action: string, value: string) => void;
  /** Bulk grant/clear every declared (resource, action) in a module (`grant` direction). */
  onBulkModule: (module: string, grant: boolean) => void;
  /** Bulk grant/clear all declared actions of one resource. */
  onBulkResource: (resource: string, grant: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Flat, ordered list of resource rows (for arrow-key navigation across groups).
  const rows = useMemo(
    () => catalog.modules.flatMap((m) => m.resources.map((r) => ({ module: m.module, ...r }))),
    [catalog],
  );

  const gridMinW = RESOURCE_W + PERMISSION_ACTIONS.length * ACTION_W + SCOPE_W + LIMIT_W;

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
    if (pending[key]) onRevoke(resource, action); // no-op on Admin (anti-lockout, handled upstream)
    else onGrant(resource, action);
  }

  function focusCell(rowIdx: number, colIdx: number) {
    const row = rows[rowIdx];
    const action = PERMISSION_ACTIONS[colIdx];
    if (!row || !action) return;
    document.getElementById(cellId(row.resource, action))?.focus();
  }

  function onCellKeyDown(
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number,
    resource: string,
    action: string,
    declared: boolean,
  ) {
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm">
      {/* card header */}
      <div className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="text-[13.5px] font-bold text-foreground">
          Permissions <span className="font-medium text-faint">· resource × action</span>
        </div>
        <div className="text-[11.5px] text-faint" data-testid="matrix-count">
          {grantCountText}
        </div>
      </div>

      {isEmptyRole && (
        <div
          className="flex flex-none items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5"
          data-testid="matrix-empty-hint"
        >
          <span className="text-info" aria-hidden>
            ⓘ
          </span>
          <span className="text-[12.5px] text-muted-foreground">
            This role has no permissions yet. Click any cell below to grant access.
          </span>
        </div>
      )}

      {/* scroll region */}
      <div
        className="min-h-0 flex-1 overflow-auto"
        data-testid="permission-matrix"
        role="grid"
        aria-label="Resource by action permission matrix"
      >
        <div style={{ minWidth: gridMinW }}>
          {/* header row (sticky) */}
          <div role="row" className="sticky top-0 z-[5] flex border-b border-border-strong bg-surface-2">
            <div
              className="sticky left-0 z-[6] flex h-[46px] flex-none items-center border-r border-border bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-foreground"
              style={{ width: RESOURCE_W }}
            >
              Resource
            </div>
            {PERMISSION_ACTIONS.map((action) => (
              <div
                key={action}
                role="columnheader"
                className="flex h-[46px] flex-none items-center justify-center border-l border-border"
                style={{ width: ACTION_W }}
              >
                <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  {PERMISSION_ACTION_LABEL[action]}
                </span>
              </div>
            ))}
            <div
              className="flex h-[46px] flex-none items-center border-l border-border px-3 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground"
              style={{ width: SCOPE_W }}
            >
              Project scope
            </div>
            <div
              className="flex h-[46px] flex-none items-center border-l border-border px-3 text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground"
              style={{ width: LIMIT_W }}
            >
              Value limit
            </div>
          </div>

          {catalog.modules.map((mod) => {
            const modKeys = keysForModule(mod.module);
            const modState = triStateFor(modKeys, pending);
            const isCollapsed = collapsed.has(mod.module);
            const modGranted = modKeys.filter((k) => pending[k]).length;
            return (
              <div key={mod.module} data-testid={`module-group-${mod.module}`}>
                {/* module group header */}
                <div
                  role="row"
                  onClick={() =>
                    setCollapsed((c) => {
                      const next = new Set(c);
                      if (next.has(mod.module)) next.delete(mod.module);
                      else next.add(mod.module);
                      return next;
                    })
                  }
                  className="cursor-pointer border-b border-border bg-surface-2 hover:bg-muted"
                  style={{ width: gridMinW }}
                >
                  <div className="sticky left-0 flex w-max items-center gap-2.5 px-4" style={{ height: 38 }}>
                    <span
                      className="flex flex-none text-muted-foreground transition-transform"
                      style={{ transform: isCollapsed ? "none" : "rotate(90deg)" }}
                      aria-hidden
                    >
                      <ChevronRight className="h-3 w-3" strokeWidth={2.6} />
                    </span>
                    <TriStateBox
                      state={modState}
                      disabled={bulkDisabled(modState)}
                      accessibleName={modState === "checked" ? `Clear all in ${mod.label}` : `Grant all in ${mod.label}`}
                      testId={`bulk-module-${mod.module}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onBulkModule(mod.module, modState !== "checked");
                      }}
                    />
                    <span className="flex-none rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                      {mod.module.toUpperCase()}
                    </span>
                    <span className="text-[12.5px] font-bold text-foreground">{mod.label}</span>
                    <span className="ml-3 text-[11px] tabular-nums text-faint">
                      {modGranted} of {modKeys.length} granted
                    </span>
                  </div>
                </div>

                {!isCollapsed &&
                  mod.resources.map((res, resIdx) => {
                    flatRowIdx += 1;
                    const rowIdx = flatRowIdx;
                    const resKeys = keysForResource(res.resource);
                    const resState = triStateFor(resKeys, pending);
                    const resGranted = resKeys.filter((k) => pending[k]).length;
                    const isLastRes = resIdx === mod.resources.length - 1;

                    // Scope/limit come from the resource's first granted action (design file:
                    // scope & limit are per-resource controls); edits fan out to all granted
                    // actions of the resource so the row stays internally consistent.
                    const grantedActions = res.actions.filter((a) => pending[cellKey(res.resource, a)]);
                    const hasGrant = grantedActions.length > 0;
                    const firstGranted = grantedActions[0];
                    const firstCell = firstGranted ? pending[cellKey(res.resource, firstGranted)] : null;
                    const rowScope: ProjectScope = isUnscopedRole ? "ALL" : (firstCell?.scope ?? "ASSIGNED");
                    const rowLimit = firstCell?.valueLimit ?? "";
                    const scopeLocked = isUnscopedRole || (isAdminRole && rowScope === "ALL");

                    return (
                      <div role="row" key={res.resource} className="flex border-b border-border" style={{ minHeight: 52 }}>
                        {/* resource cell (sticky, tree-indented) */}
                        <div
                          className="sticky left-0 z-[2] flex flex-none items-center gap-2.5 border-r border-border bg-surface py-2 pl-0 pr-3"
                          style={{ width: RESOURCE_W }}
                        >
                          <span className="relative flex-none self-stretch" style={{ width: 52 }} aria-hidden>
                            <span
                              className="absolute left-[45px] top-0 w-[1.5px] bg-border-strong"
                              style={{ bottom: isLastRes ? "50%" : 0 }}
                            />
                            <span className="absolute left-[45px] top-1/2 h-[1.5px] w-4 bg-border-strong" />
                          </span>
                          <TriStateBox
                            state={resState}
                            disabled={bulkDisabled(resState)}
                            accessibleName={`All actions — ${res.resource}`}
                            testId={`bulk-resource-${res.resource}`}
                            onClick={() => onBulkResource(res.resource, resState !== "checked")}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-semibold leading-tight text-foreground" title={res.label}>
                              {res.label}
                            </div>
                            <div className="mt-px break-words font-mono text-[10px] font-medium text-accent-ink">
                              {res.resource}
                            </div>
                            <div className="mt-0.5 text-[10.5px] text-faint">
                              {hasGrant ? `${resGranted} of ${resKeys.length} granted` : "No access"}
                            </div>
                          </div>
                        </div>

                        {/* action cells */}
                        {PERMISSION_ACTIONS.map((action, colIdx) => {
                          const declared = res.actions.includes(action);
                          const key = cellKey(res.resource, action);
                          const granted = !!pending[key];
                          const accessibleName = `${res.resource} — ${action}`;
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
                                className="flex flex-none items-center justify-center border-l border-border"
                                style={{ width: ACTION_W }}
                              >
                                <span className="h-0.5 w-3 rounded-sm bg-border-strong" aria-hidden />
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
                              title={`${accessibleName}${granted ? " — granted" : " — not granted"}`}
                              tabIndex={rowIdx === 0 && colIdx === 0 ? 0 : -1}
                              data-testid={`cell-${res.resource}-${action}`}
                              data-declared="true"
                              onClick={() => onCellClick(res.resource, action, declared)}
                              onKeyDown={(e) => onCellKeyDown(e, rowIdx, colIdx, res.resource, action, declared)}
                              className={cn(
                                "group/cell flex flex-none cursor-pointer items-center justify-center border-l border-border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                                granted ? "bg-accent-soft/40 hover:bg-accent-soft/70" : "bg-surface hover:bg-accent-soft/30",
                                cellDisabled && "pointer-events-none opacity-60",
                              )}
                              style={{ width: ACTION_W }}
                            >
                              {granted ? (
                                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-sm bg-primary text-primary-foreground">
                                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                                </span>
                              ) : (
                                <span className="h-[19px] w-[19px] rounded-sm border-[1.5px] border-border-strong bg-surface transition-colors group-hover/cell:border-accent group-hover/cell:bg-accent-soft/40" />
                              )}
                            </div>
                          );
                        })}

                        {/* project scope */}
                        <div
                          className="flex flex-none items-center border-l border-border px-3"
                          style={{ width: SCOPE_W }}
                        >
                          {hasGrant ? (
                            <div
                              role="radiogroup"
                              aria-label="Project scope"
                              title={isUnscopedRole ? "This role applies to all projects." : undefined}
                              className={cn(
                                "inline-flex gap-0.5 rounded-sm border border-border bg-muted p-0.5",
                                scopeLocked && "opacity-60",
                              )}
                            >
                              <ScopePill
                                label="ALL"
                                active={rowScope === "ALL"}
                                disabled={scopeLocked}
                                testId={`scope-all-${res.resource}`}
                                onClick={() =>
                                  grantedActions.forEach((a) => onScopeChange(res.resource, a, "ALL"))
                                }
                              />
                              <ScopePill
                                label="ASSIGNED"
                                active={rowScope === "ASSIGNED"}
                                disabled={scopeLocked}
                                testId={`scope-assigned-${res.resource}`}
                                onClick={() =>
                                  grantedActions.forEach((a) => onScopeChange(res.resource, a, "ASSIGNED"))
                                }
                              />
                            </div>
                          ) : (
                            <span className="text-[11.5px] text-faint">—</span>
                          )}
                        </div>

                        {/* value limit */}
                        <div
                          className="flex flex-none items-center border-l border-border px-3"
                          style={{ width: LIMIT_W }}
                        >
                          {hasGrant ? (
                            <div className="flex h-[30px] w-full items-center rounded-sm border border-border-strong bg-surface focus-within:border-accent focus-within:shadow-focus">
                              <span className="flex-none border-r border-border px-2 text-[12px] font-medium text-faint" aria-hidden>
                                ৳
                              </span>
                              <input
                                value={rowLimit}
                                placeholder="Role limit"
                                inputMode="decimal"
                                disabled={disabled || (isAdminRole && rowLimit === "")}
                                data-testid={`value-limit-${res.resource}`}
                                aria-label={`Value limit — ${res.resource}`}
                                onChange={(e) =>
                                  grantedActions.forEach((a) => onLimitChange(res.resource, a, e.target.value))
                                }
                                className="h-full min-w-0 flex-1 border-none bg-transparent px-2 text-right font-mono text-[11.5px] tabular-nums text-foreground outline-none placeholder:text-faint disabled:cursor-not-allowed"
                              />
                            </div>
                          ) : (
                            <span className="text-[11.5px] text-faint">—</span>
                          )}
                        </div>
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

/** One ALL/ASSIGNED scope pill (design file · inline segmented control per row). */
function ScopePill({
  label,
  active,
  disabled,
  testId,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "h-6 rounded-[5px] px-2.5 text-[10px] font-bold tracking-wide transition-colors",
        active ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground",
        disabled ? "cursor-default" : "cursor-pointer",
      )}
    >
      {label}
    </button>
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
  onClick: (e: React.MouseEvent) => void;
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
        "grid h-[19px] w-[19px] flex-none place-items-center rounded-sm border-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        state === "checked"
          ? "border-primary bg-primary text-primary-foreground"
          : state === "mixed"
            ? "border-primary bg-primary/20 text-primary"
            : "border-border-strong bg-surface",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      {state === "checked" && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
      {state === "mixed" && <Minus className="h-3 w-3" strokeWidth={3} aria-hidden />}
    </button>
  );
}
