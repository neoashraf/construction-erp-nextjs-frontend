"use client";

import { cn } from "@/lib/utils";

/**
 * One posting-dimension as a chip inside the movement lines table's Dimensions column
 * (design: "Stock Journal.dc.html" editor — draft frame). Three visual states, matching
 * the design's chip artboards exactly:
 *
 *  - **filled**   → lime `accent-soft`/`accent-ink` pill showing the selected value.
 *  - **required** → a dashed-`destructive` "<Label> required" pill (the design's
 *                   "Purpose required" chip) when the dimension is empty AND validated.
 *  - **empty**    → a faint dashed "+ <Label>" affordance (draft, not yet validated).
 *
 * Editable dimensions (project · cost centre · purpose) wrap this in `DimensionSelectChip`,
 * which lays a transparent native `<select>` over the chip so it stays a real, testable
 * form control while looking like the design's read-only chip. The godown chip is a
 * display-only mirror of the row's Godown column select (`interactive={false}`).
 */
export function DimensionChip({
  value,
  label,
  invalid,
  className,
}: {
  /** Selected display text, or "" when unset. */
  value: string;
  /** Dimension name used in the empty/required affordance ("Project", "Purpose", …). */
  label: string;
  /** Show the dashed-destructive "<Label> required" state when empty. */
  invalid?: boolean;
  className?: string;
}) {
  if (value) {
    return (
      <span
        className={cn(
          "inline-flex h-[23px] max-w-full items-center gap-1.5 truncate rounded-token bg-accent-soft px-2 text-[11.5px] font-semibold text-accent-ink",
          className,
        )}
        title={`${label}: ${value}`}
      >
        {value}
      </span>
    );
  }
  if (invalid) {
    return (
      <span
        className={cn(
          "inline-flex h-[23px] items-center gap-1.5 whitespace-nowrap rounded-token border border-dashed border-destructive bg-destructive-soft px-2 text-[11.5px] font-semibold text-destructive-ink",
          className,
        )}
      >
        {label} required
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-[23px] items-center gap-1 whitespace-nowrap rounded-token border border-dashed border-border-strong bg-surface px-2 text-[11.5px] font-medium text-muted-foreground",
        className,
      )}
    >
      + {label}
    </span>
  );
}
