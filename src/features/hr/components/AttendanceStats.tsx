import { cn } from "@/lib/utils";
import { LOW_ATTENDANCE_THRESHOLD } from "../lib/attendance-rows";

/**
 * Stat tiles + the attendance-percentage meter shared by the summary strip, the table
 * cell and the detail drawer, so a percentage is flagged low by exactly one rule
 * everywhere it appears.
 */

export type StatTone = "default" | "danger" | "muted";

const TONE_CLASS: Record<StatTone, string> = {
  default: "text-foreground",
  danger: "text-destructive-ink",
  muted: "text-muted-foreground",
};

/**
 * One labelled figure in the summary strip. An optional `caption` qualifies the figure
 * (e.g. "Estimate only — payroll uses the exact per-employee figure.") and is folded into
 * the card's accessible name so a screen-reader user never hears the bare number without
 * its qualification.
 */
export function StatCard({
  label,
  value,
  tone = "default",
  caption,
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
  caption?: string;
}) {
  return (
    <div
      className="rounded-card border border-border bg-surface px-3 py-2.5"
      role={caption ? "group" : undefined}
      aria-label={caption ? `${label} — ${caption}` : undefined}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.5px] text-faint">
        {label}
      </div>
      <div className={cn("mt-0.5 text-[17px] font-bold tabular-nums", TONE_CLASS[tone])}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      {caption ? (
        <div className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">{caption}</div>
      ) : null}
    </div>
  );
}

/**
 * Attendance percentage as a meter plus the number. Below `LOW_ATTENDANCE_THRESHOLD` the
 * bar and figure switch to the destructive tone; colour is never the only signal, the
 * number is always present.
 */
export function AttendanceMeter({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  const isLow = clamped < LOW_ATTENDANCE_THRESHOLD;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="h-1.5 w-16 flex-none overflow-hidden rounded-pill bg-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Attendance percentage"
      >
        <div
          className={cn("h-full rounded-pill", isLow ? "bg-destructive" : "bg-success")}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span
        className={cn(
          "text-[12.5px] font-semibold tabular-nums",
          isLow ? "text-destructive-ink" : "text-foreground",
        )}
      >
        {clamped}%
      </span>
    </div>
  );
}
