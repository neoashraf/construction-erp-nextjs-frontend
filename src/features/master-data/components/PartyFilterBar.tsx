"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type RoleFilter = "all" | "customers" | "suppliers";

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "customers", label: "Customers" },
  { key: "suppliers", label: "Suppliers" },
];

/** Party list filter bar (spec §4/§8): role segmented + active toggle + name search. */
export function PartyFilterBar({
  role,
  onRole,
  activeOnly,
  onActiveOnly,
  q,
  onQ,
}: {
  role: RoleFilter;
  onRole: (r: RoleFilter) => void;
  activeOnly: boolean;
  onActiveOnly: (v: boolean) => void;
  q: string;
  onQ: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Filter by role"
        className="flex gap-0.5 rounded-token border border-border bg-muted p-0.5"
      >
        {ROLE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={role === t.key}
            onClick={() => onRole(t.key)}
            className={cn(
              "rounded-sm px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              role === t.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-muted-foreground">
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(e) => onActiveOnly(e.target.checked)}
          className="h-4 w-4 rounded-sm border border-border-strong accent-accent"
        />
        Active only
      </label>

      <div className="relative ml-auto w-full max-w-[280px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
          aria-hidden
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="Search parties by name…"
          aria-label="Search parties by name"
          className="pl-9"
        />
      </div>
    </div>
  );
}
