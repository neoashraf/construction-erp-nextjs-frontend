"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { userRoleLabel } from "../types";

/**
 * User + role header (spec §5) — name, role badge, and the scope mode
 * (ASSIGNED vs ALL). Bangla-capable `name` never clips stored data — visual
 * truncation only (spec §12).
 */
export function UserScopeHeader({
  name,
  role,
  isUnscoped,
  selectionAnnounce,
}: {
  name: string;
  role: string;
  isUnscoped: boolean;
  selectionAnnounce?: string;
}) {
  const initials = initialsOf(name);
  return (
    <Card className="flex flex-none items-center gap-3.5 p-4" data-testid="user-scope-header">
      <div
        className="grid h-[46px] w-[46px] flex-none place-items-center rounded-full bg-accent-soft text-base font-bold text-accent-ink"
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate whitespace-normal break-words text-base font-bold text-foreground">
            {name}
          </span>
          <Badge tone={isUnscoped ? "accent" : "info"}>{userRoleLabel(role)}</Badge>
        </div>
        <div className="mt-1 text-[12.5px] text-muted-foreground">
          Scope mode{" "}
          <span className="font-mono font-semibold text-foreground">
            {isUnscoped ? "ALL" : "ASSIGNED"}
          </span>{" "}
          {isUnscoped ? "· unscoped role" : "· transacts only on the projects below"}
        </div>
      </div>
      {selectionAnnounce ? (
        <span
          aria-live="polite"
          className="flex-none rounded-pill bg-muted px-3 py-1 text-[11.5px] font-semibold tabular-nums text-muted-foreground"
          data-testid="selection-announce"
        >
          {selectionAnnounce}
        </span>
      ) : null}
    </Card>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
