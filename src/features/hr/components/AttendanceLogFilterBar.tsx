"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { IsoDateField } from "./IsoDateField";
import {
  monthBounds,
  selectableYears,
  type DateMode,
  type FilterDraft,
} from "../lib/attendance-filters";
import { parseDateOnly, toIsoDate } from "../lib/attendance-time";

/**
 * Filter controls for the attendance-log table.
 *
 * The parent owns both the draft and the applied filters; this component only edits the
 * draft and reports intent. Two interactions bypass Apply deliberately — a mode change and
 * the Summary toggle both re-apply immediately, because each one changes the *shape* of
 * the table, and leaving the columns describing rows that were never fetched is worse than
 * an extra request.
 */

const MODES: { value: DateMode; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "single", label: "Single" },
  { value: "range", label: "Range" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function AttendanceLogFilterBar({
  draft,
  onDraftChange,
  onModeChange,
  onApply,
  onClear,
  onToggleSummary,
  canSummarize,
  showClear,
  busy,
}: {
  draft: FilterDraft;
  onDraftChange: (next: FilterDraft) => void;
  onModeChange: (mode: DateMode) => void;
  onApply: () => void;
  onClear: () => void;
  onToggleSummary: (next: boolean) => void;
  canSummarize: boolean;
  showClear: boolean;
  busy?: boolean;
}) {
  const isRange = draft.mode === "range";
  const isMonth = draft.mode === "month";

  // The month select is driven by whichever month dateFrom currently lands in.
  const monthAnchor = parseDateOnly(draft.dateFrom) ?? new Date();
  const selectedMonth = monthAnchor.getMonth();
  const selectedYear = monthAnchor.getFullYear();

  function pickMonth(monthIndex: number, year: number) {
    const bounds = monthBounds(toIsoDate(new Date(year, monthIndex, 1)));
    onDraftChange({ ...draft, ...bounds });
  }

  // Includes the selected year even if it falls outside the default window.
  const years = selectableYears(selectedYear);

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Date mode */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
            Period
          </span>
          <div className="inline-flex rounded-token border border-border-strong p-0.5" role="group" aria-label="Date mode">
            {MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                aria-pressed={draft.mode === mode.value}
                disabled={busy}
                onClick={() => onModeChange(mode.value)}
                className={cn(
                  "h-7 rounded-sm px-3 text-[12.5px] font-semibold transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  draft.mode === mode.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Month mode — month + year selects */}
        {isMonth ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="attendance-month" className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
              Month
            </label>
            <div className="flex gap-2">
              <Select
                id="attendance-month"
                className="h-9 w-[132px]"
                value={selectedMonth}
                disabled={busy}
                onChange={(e) => pickMonth(Number(e.target.value), selectedYear)}
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Year"
                className="h-9 w-[92px]"
                value={selectedYear}
                disabled={busy}
                onChange={(e) => pickMonth(selectedMonth, Number(e.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : null}

        {/* Single-day mode */}
        {draft.mode === "single" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="attendance-date" className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
              Date
            </label>
            <div className="w-[150px]">
              <IsoDateField
                id="attendance-date"
                value={draft.date}
                disabled={busy}
                onChange={(date) => onDraftChange({ ...draft, date })}
              />
            </div>
          </div>
        ) : null}

        {/* Range mode */}
        {isRange ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="attendance-from" className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
                From
              </label>
              <div className="w-[150px]">
                <IsoDateField
                  id="attendance-from"
                  value={draft.dateFrom}
                  disabled={busy}
                  onChange={(dateFrom) => onDraftChange({ ...draft, dateFrom })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="attendance-to" className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
                To
              </label>
              <div className="w-[150px]">
                <IsoDateField
                  id="attendance-to"
                  value={draft.dateTo}
                  disabled={busy}
                  onChange={(dateTo) => onDraftChange({ ...draft, dateTo })}
                />
              </div>
            </div>
          </>
        ) : null}

        {/* Search — one box, routed to userId or name by content */}
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <label htmlFor="attendance-search" className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <Input
              id="attendance-search"
              className="pl-9"
              placeholder="Employee ID or name"
              value={draft.search}
              disabled={busy}
              onChange={(e) => onDraftChange({ ...draft, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onApply();
                }
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onApply} disabled={busy}>
            Apply
          </Button>
          {showClear ? (
            <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
              <X className="h-4 w-4" aria-hidden />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {/* Summary toggle — only meaningful over a multi-day window */}
      {canSummarize ? (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            aria-pressed={draft.summary}
            disabled={busy}
            onClick={() => onToggleSummary(!draft.summary)}
            className={cn(
              "inline-flex h-7 items-center gap-2 rounded-pill border px-3 text-[12px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              draft.summary
                ? "border-accent-border bg-accent-soft text-accent-ink"
                : "border-border-strong bg-surface text-muted-foreground hover:bg-muted",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                draft.summary ? "bg-accent-ink" : "bg-muted-foreground",
              )}
              aria-hidden
            />
            Summary mode
          </button>
          <span className="ml-2 text-[11.5px] text-muted-foreground">
            Aggregated totals per employee — per-day detail is unavailable.
          </span>
        </div>
      ) : null}
    </div>
  );
}
