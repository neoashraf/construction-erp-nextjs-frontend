"use client";

import { cn } from "@/lib/utils";
import { ROLE_NAMES, ROLE_NAME_LABEL, type RoleListItem } from "../types";

/**
 * Role selector — the six fixed platform roles (spec §3/§5; FR-AUD-011). Not
 * creatable/deletable in Phase 1; selecting a role drives the whole editor.
 * Roles the API hasn't returned yet (unlikely — pre-seeded) are skipped.
 */
export function RoleSelector({
  roles,
  selectedId,
  onSelect,
}: {
  roles: RoleListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Preserve the design file's fixed six-role order regardless of API ordering.
  const ordered = ROLE_NAMES.map((name) => roles.find((r) => r.name === name)).filter(
    (r): r is RoleListItem => !!r,
  );

  return (
    <div>
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Role
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Role">
        {ordered.map((r) => {
          const active = r.id === selectedId;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(r.id)}
              data-testid={`role-tab-${r.name}`}
              className={cn(
                "flex h-[34px] items-center gap-2 rounded-token border px-3.5 text-sm font-semibold transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border-strong bg-background text-foreground hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 flex-none rounded-full",
                  r.isUnscoped ? "bg-accent" : "bg-border-strong",
                )}
                aria-hidden
              />
              {ROLE_NAME_LABEL[r.name as keyof typeof ROLE_NAME_LABEL] ?? r.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
