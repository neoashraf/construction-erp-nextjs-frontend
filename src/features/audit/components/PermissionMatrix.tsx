"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PERMISSION_MODULES,
  PERMISSION_MODULE_LABEL,
  PERMISSION_ACTIONS,
  PERMISSION_ACTION_LABEL,
  type PendingPermissionMap,
  type ProjectScope,
} from "../types";
import { cellKey } from "../schemas/permission-diff";
import { ScopeControl } from "./ScopeControl";
import { ValueLimitInput } from "./ValueLimitInput";

/**
 * The module x action permission matrix (spec §3/§4/§5/§10; FR-AUD-012/013).
 * 16 modules x 8 actions, sticky header row + sticky first (module) column.
 * Clicking an ungranted cell grants it (default scope ALL for an unscoped role,
 * ASSIGNED otherwise) and opens the inline scope/limit editor sub-row for that
 * module; clicking a granted cell re-opens the editor. Arrow keys move focus
 * between cells; Space toggles the focused cell (spec §10 keyboard data grid).
 * (Local variables are named `moduleCode` — `module` is a reserved identifier
 * under the Next.js ESLint rule `no-assign-module-variable`.)
 */
export function PermissionMatrix({
  pending,
  isUnscopedRole,
  roleApprovalLimit,
  isEmptyRole,
  disabled,
  onGrant,
  onRevoke,
  onScopeChange,
  onLimitChange,
}: {
  pending: PendingPermissionMap;
  isUnscopedRole: boolean;
  roleApprovalLimit: string | null;
  isEmptyRole: boolean;
  disabled: boolean;
  onGrant: (moduleCode: string, action: string) => void;
  onRevoke: (moduleCode: string, action: string) => void;
  onScopeChange: (moduleCode: string, action: string, scope: ProjectScope) => void;
  onLimitChange: (moduleCode: string, action: string, value: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const grantedCount = Object.values(pending).filter((v) => v !== null).length;
  const total = PERMISSION_MODULES.length * PERMISSION_ACTIONS.length;

  function cellId(moduleCode: string, action: string): string {
    return `perm-cell-${moduleCode}-${action}`;
  }

  function onCellClick(moduleCode: string, action: string) {
    if (disabled) return;
    const key = cellKey(moduleCode, action);
    const granted = pending[key];
    if (!granted) {
      onGrant(moduleCode, action);
      setSelected(key);
    } else {
      setSelected((s) => (s === key ? null : key));
    }
  }

  function moveFocus(rowIdx: number, colIdx: number) {
    const moduleCode = PERMISSION_MODULES[rowIdx];
    const action = PERMISSION_ACTIONS[colIdx];
    if (!moduleCode || !action) return;
    const el = document.getElementById(cellId(moduleCode, action));
    el?.focus();
  }

  function onCellKeyDown(
    e: React.KeyboardEvent,
    rowIdx: number,
    colIdx: number,
    moduleCode: string,
    action: string,
  ) {
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveFocus(rowIdx, Math.min(PERMISSION_ACTIONS.length - 1, colIdx + 1));
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveFocus(rowIdx, Math.max(0, colIdx - 1));
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocus(Math.min(PERMISSION_MODULES.length - 1, rowIdx + 1), colIdx);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocus(Math.max(0, rowIdx - 1), colIdx);
        break;
      case " ":
      case "Spacebar":
        e.preventDefault();
        onCellClick(moduleCode, action);
        break;
      default:
        break;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-none rounded-t-card border border-border bg-surface shadow-sm">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="text-[13.5px] font-bold text-foreground">Permission matrix</div>
        <div className="text-[11.5px] text-faint" data-testid="matrix-count">
          {grantedCount} / {total} granted
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

      <div
        className="min-h-0 flex-1 overflow-auto"
        data-testid="permission-matrix"
        role="grid"
        aria-label="Module by action permission matrix"
      >
        <div style={{ minWidth: 956 }}>
          {/* header row */}
          <div
            role="row"
            className="sticky top-0 z-[5] flex border-b border-border-strong bg-surface-2"
          >
            <div className="sticky left-0 z-[6] flex h-[52px] w-[220px] flex-none items-center border-r border-border bg-surface-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-foreground">
              Module / Permission
            </div>
            {PERMISSION_ACTIONS.map((action) => (
              <div
                key={action}
                role="columnheader"
                className="flex h-[52px] w-[92px] flex-none flex-col items-center justify-center gap-0.5 border-l border-border"
              >
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {PERMISSION_ACTION_LABEL[action]}
                </span>
              </div>
            ))}
          </div>

          {/* body rows */}
          {PERMISSION_MODULES.map((moduleCode, rowIdx) => {
            const rowGrantCount = PERMISSION_ACTIONS.filter(
              (a) => pending[cellKey(moduleCode, a)],
            ).length;
            const editingKey = selected && selected.startsWith(`${moduleCode}|`) ? selected : null;
            const editingAction = editingKey ? editingKey.split("|")[1] : null;

            return (
              <div key={moduleCode}>
                <div role="row" className="flex border-b border-border">
                  <div className="sticky left-0 z-[2] flex min-h-[54px] w-[220px] flex-none items-center gap-2.5 border-r border-border bg-surface px-4">
                    <span className="flex-none rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-muted-foreground">
                      {moduleCode}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-foreground">
                        {PERMISSION_MODULE_LABEL[moduleCode]}
                      </div>
                      <div className="text-[10.5px] tabular-nums text-faint">
                        {rowGrantCount} / {PERMISSION_ACTIONS.length}
                      </div>
                    </div>
                  </div>

                  {PERMISSION_ACTIONS.map((action, colIdx) => {
                    const key = cellKey(moduleCode, action);
                    const cell = pending[key];
                    const granted = !!cell;
                    const isSelected = selected === key;
                    // Spec §10: the accessible name combines module + action codes
                    // exactly, e.g. "PUR — APPROVE" (not the humanised action label).
                    const accessibleName = `${moduleCode} — ${action}`;
                    const scopeText = granted ? (isUnscopedRole ? "ALL" : cell.scope) : "";
                    const hasCustomLimit = granted && cell.valueLimit != null;

                    return (
                      <div
                        key={key}
                        id={cellId(moduleCode, action)}
                        role="checkbox"
                        aria-checked={granted}
                        aria-label={accessibleName}
                        title={`${accessibleName}${granted ? ` — granted (${scopeText})` : " — not granted"}`}
                        tabIndex={rowIdx === 0 && colIdx === 0 ? 0 : -1}
                        data-testid={`cell-${moduleCode}-${action}`}
                        onClick={() => onCellClick(moduleCode, action)}
                        onKeyDown={(e) => onCellKeyDown(e, rowIdx, colIdx, moduleCode, action)}
                        className={cn(
                          "flex min-h-[54px] w-[92px] flex-none cursor-pointer flex-col items-center justify-center gap-1 border-l border-border outline-none",
                          granted
                            ? isSelected
                              ? "bg-accent-soft/80"
                              : "bg-accent-soft/40"
                            : isSelected
                              ? "bg-muted"
                              : "bg-background",
                          disabled && "pointer-events-none opacity-60",
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
                    moduleCode={moduleCode}
                    action={editingAction}
                    cell={
                      pending[editingKey] ?? {
                        scope: isUnscopedRole ? "ALL" : "ASSIGNED",
                        valueLimit: null,
                      }
                    }
                    isUnscopedRole={isUnscopedRole}
                    roleApprovalLimit={roleApprovalLimit}
                    onScopeChange={(scope) => onScopeChange(moduleCode, editingAction, scope)}
                    onLimitChange={(value) => onLimitChange(moduleCode, editingAction, value)}
                    onRevoke={() => {
                      onRevoke(moduleCode, editingAction);
                      setSelected(null);
                    }}
                    onDone={() => setSelected(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PermissionEditorRow({
  moduleCode,
  action,
  cell,
  isUnscopedRole,
  roleApprovalLimit,
  onScopeChange,
  onLimitChange,
  onRevoke,
  onDone,
}: {
  moduleCode: string;
  action: string;
  cell: { scope: ProjectScope; valueLimit: string | null };
  isUnscopedRole: boolean;
  roleApprovalLimit: string | null;
  onScopeChange: (scope: ProjectScope) => void;
  onLimitChange: (value: string) => void;
  onRevoke: () => void;
  onDone: () => void;
}) {
  const key = cellKey(moduleCode, action);
  return (
    <div
      className="sticky left-0 flex flex-wrap items-center gap-5 border-b border-border-strong bg-surface-2 px-4.5 py-3.5"
      data-testid={`editor-row-${moduleCode}-${action}`}
    >
      <div className="flex flex-none items-center gap-2">
        <span className="rounded-token bg-muted px-2 py-1 font-mono text-[11px] font-semibold text-foreground">
          {moduleCode} ·{" "}
          {PERMISSION_ACTION_LABEL[action as keyof typeof PERMISSION_ACTION_LABEL] ?? action}
        </span>
        <span className="text-[12.5px] text-muted-foreground">
          {PERMISSION_MODULE_LABEL[moduleCode as keyof typeof PERMISSION_MODULE_LABEL] ??
            moduleCode}
        </span>
      </div>

      <ScopeControl
        value={isUnscopedRole ? "ALL" : cell.scope}
        isUnscopedRole={isUnscopedRole}
        onChange={onScopeChange}
      />

      <ValueLimitInput
        cellKey={key}
        value={cell.valueLimit ?? ""}
        roleApprovalLimit={roleApprovalLimit}
        isUnscopedRole={isUnscopedRole}
        onChange={onLimitChange}
      />

      <div className="ml-auto flex flex-none gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRevoke}
          data-testid={`revoke-${moduleCode}-${action}`}
        >
          Revoke
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDone}
          data-testid={`done-${moduleCode}-${action}`}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
