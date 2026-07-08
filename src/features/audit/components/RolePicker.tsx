"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { roleNameLabel, type RoleListItem } from "../types";

/**
 * Role picker (design file · RBAC v2 meta-card "Role" dropdown). Replaces the old
 * left-hand role list: a single button in the editor's meta card opens a listbox of
 * every role (built-in + custom). Built-ins carry a "System" badge and are non-
 * deletable; custom roles show a Delete affordance (blocked when `userCount > 0` →
 * ROLE_IN_USE, disabled here). "New role" creates a custom role.
 */
export function RolePicker({
  roles,
  selectedId,
  onSelect,
  onNewRole,
  onDeleteRole,
  canCreate = true,
  canDelete = true,
}: {
  roles: RoleListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewRole: () => void;
  onDeleteRole: (role: RoleListItem) => void;
  /** "New role" needs the CREATE grant; per-role Delete needs the DELETE grant. */
  canCreate?: boolean;
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function roleLabel(r: RoleListItem): string {
    return roleNameLabel(r.name);
  }

  const selected = roles.find((r) => r.id === selectedId);
  const selectedLabel = selected ? roleLabel(selected) : "Select a role";

  return (
    <div ref={ref} className="relative z-20">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="role-picker"
        className="flex h-10 items-center gap-2.5 rounded-token border border-border-strong bg-surface pl-3 pr-2.5 transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">Role</span>
        <span className="whitespace-nowrap text-[15px] font-bold tracking-[-0.01em] text-foreground">
          {selectedLabel}
        </span>
        <span
          className={cn(
            "grid h-6 w-6 flex-none place-items-center rounded-sm bg-muted text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        >
          <ChevronDown className="h-3 w-3" />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch role"
          className="absolute left-0 top-[46px] z-50 w-[312px] rounded-card border border-border-strong bg-surface p-1.5 shadow-lg"
        >
          <div className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-faint">
            Switch role · {roles.length} role{roles.length === 1 ? "" : "s"}
          </div>
          {roles.map((r) => {
            const active = r.id === selectedId;
            return (
              <div
                key={r.id}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onSelect(r.id);
                  setOpen(false);
                }}
                data-testid={`role-option-${r.name}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-token px-2.5 py-1.5 transition-colors hover:bg-accent-soft",
                  active && "bg-accent-soft/60",
                )}
              >
                <span
                  className={cn("flex w-4 flex-none items-center justify-center text-accent-ink", !active && "opacity-0")}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-foreground">{roleLabel(r)}</span>
                    {r.isSystem && (
                      <span
                        data-testid={`system-badge-${r.name}`}
                        className="inline-flex h-4 flex-none items-center rounded-sm bg-muted px-1.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground"
                      >
                        System
                      </span>
                    )}
                  </div>
                  <div className="mt-px text-[11px] tabular-nums text-faint">
                    {r.userCount} user{r.userCount === 1 ? "" : "s"}
                  </div>
                </div>
                {!r.isSystem && canDelete && (
                  <button
                    type="button"
                    title={`Delete ${roleLabel(r)}`}
                    aria-label={`Delete ${roleLabel(r)}`}
                    data-testid={`delete-role-${r.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRole(r);
                    }}
                    className="grid h-[26px] w-[26px] flex-none cursor-pointer place-items-center rounded-token text-muted-foreground transition-colors hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            );
          })}
          {canCreate && (
            <>
              <div className="mx-1 my-1.5 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNewRole();
                }}
                data-testid="new-role-picker"
                className="flex h-9 w-full items-center gap-2 rounded-token px-2.5 text-left text-[13px] font-semibold text-primary transition-colors hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New role
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
