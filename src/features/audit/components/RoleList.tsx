"use client";

import { Trash2, Plus, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_NAME_LABEL, type RoleListItem } from "../types";

/**
 * Role list (spec §3/§5 · RBAC v2 · FR-AUD-011/034). Built-in roles (`isSystem`)
 * carry a "System" badge and are name-locked / non-deletable; custom roles show a
 * Delete affordance (blocked when `userCount > 0` → ROLE_IN_USE). "New role" creates
 * a custom role. Selecting a role drives the editor.
 */
export function RoleList({
  roles,
  selectedId,
  onSelect,
  onNewRole,
  onDeleteRole,
}: {
  roles: RoleListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewRole: () => void;
  onDeleteRole: (role: RoleListItem) => void;
}) {
  function roleLabel(r: RoleListItem): string {
    return ROLE_NAME_LABEL[r.name as keyof typeof ROLE_NAME_LABEL] ?? r.name;
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Roles</div>
        <Button size="sm" onClick={onNewRole} data-testid="new-role">
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          New role
        </Button>
      </div>
      <div className="flex flex-col gap-1.5" role="tablist" aria-label="Roles">
        {roles.map((r) => {
          const active = r.id === selectedId;
          return (
            <div
              key={r.id}
              className={cn(
                "group flex items-center gap-2 rounded-token border px-3 py-2 transition-colors",
                active ? "border-primary bg-primary/5" : "border-border-strong bg-background hover:bg-muted",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(r.id)}
                data-testid={`role-tab-${r.name}`}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className={cn("h-1.5 w-1.5 flex-none rounded-full", r.isUnscoped ? "bg-accent" : "bg-border-strong")} aria-hidden />
                <span className={cn("truncate text-sm font-semibold", active ? "text-foreground" : "text-foreground")}>{roleLabel(r)}</span>
                {r.isSystem ? (
                  <Badge tone="neutral" className="ml-1 h-5 gap-1" data-testid={`system-badge-${r.name}`}>
                    <Lock className="h-2.5 w-2.5" aria-hidden />
                    System
                  </Badge>
                ) : (
                  <Badge tone="accent" className="ml-1 h-5" data-testid={`custom-badge-${r.id}`}>
                    Custom
                  </Badge>
                )}
                <span className="ml-auto flex-none text-[11px] tabular-nums text-faint">{r.userCount} user{r.userCount === 1 ? "" : "s"}</span>
              </button>
              {!r.isSystem && (
                <button
                  type="button"
                  aria-label={`Delete ${roleLabel(r)}`}
                  data-testid={`delete-role-${r.id}`}
                  onClick={() => onDeleteRole(r)}
                  className="grid h-7 w-7 flex-none place-items-center rounded-token text-muted-foreground opacity-0 transition-opacity hover:bg-destructive-soft hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
