"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, parseDate } from "@/lib/format";

/**
 * Date field with a click-to-pick calendar (design-system §5.1). Keeps the manual
 * `DD/MM/YYYY` text entry the app standardises on (Bangla digits still typeable) and
 * ADDS a calendar popover for mouse users. Dependency-free: a small month grid, no
 * date library. Emits/consumes the value as a `DD/MM/YYYY` string so it drops into
 * the existing react-hook-form fields (`value` + `onChange`) unchanged.
 */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface DatePickerInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  /** Which edge of the field the calendar aligns to (default "left" — opens rightward). */
  align?: "left" | "right";
  "aria-describedby"?: string;
}

/** Parse a `DD/MM/YYYY` string to a UTC Date, or null if not a complete valid date. */
function tryParse(value: string): Date | null {
  try {
    return parseDate(value);
  } catch {
    return null;
  }
}

export const DatePickerInput = React.forwardRef<HTMLInputElement, DatePickerInputProps>(
  ({ id, value, onChange, onBlur, name, placeholder = "DD/MM/YYYY", invalid, disabled, className, align = "left", ...aria }, ref) => {
    const [open, setOpen] = React.useState(false);
    // Which pane is showing: day grid, month grid, or year grid (click the header to switch).
    const [mode, setMode] = React.useState<"days" | "months" | "years">("days");
    const wrapRef = React.useRef<HTMLDivElement>(null);

    // The month the calendar is showing — seeded from the typed value, else today (UTC).
    const parsed = tryParse(value);
    const [view, setView] = React.useState(() => {
      const d = parsed ?? new Date();
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

    // When the popover opens, jump the view to the currently-typed date and reset to the day grid.
    React.useEffect(() => {
      if (open) {
        if (parsed) setView({ year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() });
        setMode("days");
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Close on outside click / Escape.
    React.useEffect(() => {
      if (!open) return;
      function onDocClick(e: MouseEvent) {
        if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
      }
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") setOpen(false);
      }
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDocClick);
        document.removeEventListener("keydown", onKey);
      };
    }, [open]);

    const selected = parsed;
    const firstOfMonth = new Date(Date.UTC(view.year, view.month, 1));
    const startWeekday = firstOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
    const today = new Date();

    const cells: (number | null)[] = [
      ...Array.from({ length: startWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    function pick(day: number) {
      const picked = new Date(Date.UTC(view.year, view.month, day));
      onChange(formatDate(picked));
      setOpen(false);
    }
    function stepMonth(delta: number) {
      setView((v) => {
        const m = v.month + delta;
        const year = v.year + Math.floor(m / 12);
        const month = ((m % 12) + 12) % 12;
        return { year, month };
      });
    }

    function sameUTC(a: Date, y: number, m: number, d: number): boolean {
      return a.getUTCFullYear() === y && a.getUTCMonth() === m && a.getUTCDate() === d;
    }

    // Header click cycles days → months → years; the prev/next arrows step by the visible unit.
    function onHeaderClick() {
      setMode((m) => (m === "days" ? "months" : m === "months" ? "years" : "days"));
    }
    function stepHeader(delta: number) {
      if (mode === "days") stepMonth(delta);
      else if (mode === "months") setView((v) => ({ ...v, year: v.year + delta }));
      else setView((v) => ({ ...v, year: v.year + delta * 12 })); // years pane pages by 12
    }
    // A 12-year window around the current view year (aligned to a 12-block).
    const yearBlockStart = view.year - (((view.year % 12) + 12) % 12);
    const yearWindow = Array.from({ length: 12 }, (_, i) => yearBlockStart + i);
    const headerLabel =
      mode === "years"
        ? `${yearWindow[0]} – ${yearWindow[yearWindow.length - 1]}`
        : mode === "months"
          ? `${view.year}`
          : `${MONTHS[view.month]} ${view.year}`;

    return (
      <div ref={wrapRef} className="relative">
        <div className="relative">
          <input
            id={id}
            ref={ref}
            name={name}
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            {...aria}
            className={cn(
              "flex h-9 w-full rounded-token border border-border-strong bg-background pl-3 pr-9 font-mono text-sm text-foreground",
              "placeholder:text-faint transition-colors",
              "focus:border-accent focus:outline-none focus:shadow-focus",
              "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
              invalid && "border-destructive focus:border-destructive focus:shadow-focus-error",
              className,
            )}
          />
          <button
            type="button"
            aria-label="Open calendar"
            aria-haspopup="dialog"
            aria-expanded={open}
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CalendarIcon className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {open && (
          <div
            role="dialog"
            aria-label="Choose date"
            className={cn(
              "absolute z-50 mt-1 w-[260px] rounded-md border border-border bg-surface p-3 shadow-lg",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {/* header: clickable month/year label (switches pane) + prev/next */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label={mode === "years" ? "Previous years" : mode === "months" ? "Previous year" : "Previous month"}
                onClick={() => stepHeader(-1)}
                className="grid h-7 w-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={onHeaderClick}
                aria-label="Switch to month and year selection"
                className="rounded-sm px-2 py-0.5 text-[13px] font-semibold tabular-nums text-foreground hover:bg-muted"
              >
                {headerLabel}
              </button>
              <button
                type="button"
                aria-label={mode === "years" ? "Next years" : mode === "months" ? "Next year" : "Next month"}
                onClick={() => stepHeader(1)}
                className="grid h-7 w-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {/* DAY pane */}
            {mode === "days" && (
              <>
                <div className="mb-1 grid grid-cols-7 gap-0.5">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="grid h-6 place-items-center text-[10px] font-semibold uppercase text-faint">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {cells.map((day, i) =>
                    day === null ? (
                      <span key={`empty-${i}`} />
                    ) : (
                      <button
                        key={day}
                        type="button"
                        onClick={() => pick(day)}
                        aria-current={
                          selected && sameUTC(selected, view.year, view.month, day) ? "date" : undefined
                        }
                        className={cn(
                          "grid h-8 place-items-center rounded-sm text-[13px] tabular-nums transition-colors",
                          selected && sameUTC(selected, view.year, view.month, day)
                            ? "bg-primary font-semibold text-primary-foreground"
                            : "text-foreground hover:bg-accent-soft",
                          !selected &&
                            sameUTC(today, view.year, view.month, day) &&
                            "font-semibold text-accent-ink",
                        )}
                      >
                        {day}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}

            {/* MONTH pane — pick a month, drop back to the day grid */}
            {mode === "months" && (
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((label, m) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setView((v) => ({ ...v, month: m }));
                      setMode("days");
                    }}
                    className={cn(
                      "grid h-9 place-items-center rounded-sm text-[12.5px] transition-colors",
                      m === view.month
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-foreground hover:bg-accent-soft",
                    )}
                  >
                    {label.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {/* YEAR pane — pick a year, advance to the month grid */}
            {mode === "years" && (
              <div className="grid grid-cols-3 gap-1">
                {yearWindow.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setView((v) => ({ ...v, year: y }));
                      setMode("months");
                    }}
                    className={cn(
                      "grid h-9 place-items-center rounded-sm text-[12.5px] tabular-nums transition-colors",
                      y === view.year
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-foreground hover:bg-accent-soft",
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
DatePickerInput.displayName = "DatePickerInput";
