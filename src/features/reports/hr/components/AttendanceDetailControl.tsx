"use client";

import { cn } from "@/lib/utils";
import {
  ATTENDANCE_LEVELS,
  ATTENDANCE_LEVEL_LABEL,
  type AttendanceLevel,
} from "../types";

/**
 * FE-66 — the attendance report's **detail-level** control (spec §3, §10).
 *
 * Deliberately a `role="radiogroup"` named "Detail", **subordinate** to the
 * Level-1 report switcher (which stays a `role="tablist"`) — not a fourth and
 * fifth sibling tab. Splitting the grains into sibling entries would read as
 * five reports to reconcile against each other, when they are three reports and
 * three grains of one of them (FR-RPT-004, FR-RPT-026). The accessible name is
 * what keeps that distinction audible to a screen-reader user.
 *
 * Rendered ONLY while Attendance summary is the active report.
 */
export function AttendanceDetailControl({
  value,
  onChange,
  disabled,
}: {
  value: AttendanceLevel;
  onChange: (next: AttendanceLevel) => void;
  disabled?: boolean;
}) {
  /** Arrow keys move between radios, as a radiogroup is expected to. */
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    if (!forward && !back) return;
    event.preventDefault();
    const i = ATTENDANCE_LEVELS.indexOf(value);
    const next =
      ATTENDANCE_LEVELS[(i + (forward ? 1 : ATTENDANCE_LEVELS.length - 1)) % ATTENDANCE_LEVELS.length]!;
    onChange(next);
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
      data-testid="attendance-detail-control"
    >
      <span
        id="attendance-detail-label"
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        Detail
      </span>

      <div
        role="radiogroup"
        aria-label="Detail"
        aria-labelledby="attendance-detail-label"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1.5"
      >
        {ATTENDANCE_LEVELS.map((level) => {
          const active = level === value;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              // Roving tabindex — the group is one tab stop, arrows move within it.
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(level)}
              className={cn(
                "rounded-pill border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:shadow-focus",
                "disabled:cursor-not-allowed disabled:opacity-60",
                active
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-border-strong bg-background text-muted-foreground hover:bg-muted",
              )}
              data-testid={`attendance-level-${level.toLowerCase()}`}
            >
              {ATTENDANCE_LEVEL_LABEL[level]}
            </button>
          );
        })}
      </div>

      <p className="max-w-[520px] text-[11.5px] leading-snug text-muted-foreground">
        Daily shows one row per employee per day. Range totals each employee over the dates you
        choose. Summary is the monthly roll-up.
      </p>
    </div>
  );
}
