"use client";

import { cn } from "@/lib/utils";
import { type ReportDescriptor } from "../types";

/**
 * FE-54 browse-view catalog — report search chips only. The category-tab strip
 * was removed; without a search the catalog shows no browse chips (a report is
 * opened via its own viewer switcher). Selecting a chip calls `onSelect`.
 */

/** Balance reports use an as-of/period (violet); flow reports use a date range (blue). */
function chipTone(r: ReportDescriptor): "balance" | "flow" {
  return r.supportsAsOf && !r.supportsDateRange ? "balance" : "flow";
}

export function ReportCatalogBrowse({
  reports,
  selected,
  onSelect,
  query,
}: {
  reports: ReportDescriptor[];
  selected: string | null;
  onSelect: (d: ReportDescriptor) => void;
  query: string;
}) {
  const q = query.trim().toLowerCase();
  // Chips only appear while searching — results span categories, so they're the picker.
  const chips = q ? reports.filter((r) => r.title.toLowerCase().includes(q)) : [];

  return (
    <div data-testid="report-catalog-browse">

      {/* report chips — only while searching (results span categories) */}
      {q && chips.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          No reports match “{query.trim()}”.
        </p>
      ) : chips.length === 0 ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((r) => {
            const active = selected === r.name;
            const tone = chipTone(r);
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => onSelect(r)}
                data-testid={`catalog-chip-${r.name}`}
                data-active={active ? "true" : "false"}
                title={r.description}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-token border px-3 text-[12.5px] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  active
                    ? "border-accent bg-accent-soft font-semibold text-accent-ink"
                    : "border-border-strong bg-surface font-medium text-foreground hover:border-border-hover hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    tone === "balance" ? "bg-violet" : "bg-info",
                  )}
                />
                {r.title}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
