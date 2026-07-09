"use client";

import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ItemStatusFilter = "active" | "all";

const STATUS_TABS: { key: ItemStatusFilter; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "all", label: "All" },
];

/** A field label above a filter control (uppercase micro-label per Items.dc.html). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Item list filter bar (spec §4; Items.dc.html). A card holding a Status segmented
 * control (fill on active), a labelled code/name search, and Apply / Clear actions.
 * `q` is a draft applied on Apply / Enter.
 */
export function ItemFilterBar({
  status,
  onStatus,
  q,
  onQ,
  onApply,
  onClear,
}: {
  status: ItemStatusFilter;
  onStatus: (s: ItemStatusFilter) => void;
  q: string;
  onQ: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <Card className="p-3.5 sm:px-4">
      <div className="flex flex-wrap items-end gap-3.5">
        {/* Status */}
        <div className="flex flex-none flex-col gap-1.5">
          <FieldLabel>Status</FieldLabel>
          <div
            role="group"
            aria-label="Filter by status"
            className="flex h-9 gap-0.5 rounded-token bg-muted p-0.5"
          >
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={status === t.key}
                onClick={() => onStatus(t.key)}
                className={cn(
                  "flex items-center rounded-sm px-3.5 text-[12.5px] font-semibold transition-colors",
                  status === t.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <FieldLabel>Search</FieldLabel>
          <div className="flex h-9 min-w-0 items-center gap-2 rounded-token border border-border-strong bg-surface px-3 transition-colors focus-within:border-accent focus-within:shadow-focus">
            <Search className="h-3.5 w-3.5 flex-none text-faint" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => onQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onApply();
              }}
              placeholder="Search by code or name"
              aria-label="Search items by code or name"
              className="min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-faint"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-none items-end gap-2">
          <Button size="sm" className="h-9 px-4" onClick={onApply}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" className="h-9 px-2.5" onClick={onClear}>
            Clear filters
          </Button>
        </div>
      </div>
    </Card>
  );
}
