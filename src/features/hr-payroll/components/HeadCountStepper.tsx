"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Head-count stepper (Attendance.dc.html). − [n] ＋, min 1. Read-only rows render the
 * number as plain mono text. ≥28px controls (44px+ on the mobile card variant).
 */
export function HeadCountStepper({
  value,
  onChange,
  readOnly,
  size = "sm",
}: {
  value: number;
  onChange?: (next: number) => void;
  readOnly?: boolean;
  size?: "sm" | "lg";
}) {
  if (readOnly) {
    return <span className="font-mono text-[13px] tabular-nums text-muted-foreground">{value}</span>;
  }
  const btn = cn(
    "grid flex-none place-items-center rounded-token border border-border-strong text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40",
    size === "lg" ? "h-11 w-11" : "h-7 w-7",
  );
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        aria-label="Decrease head count"
        className={btn}
        disabled={value <= 1}
        onClick={() => onChange?.(Math.max(1, value - 1))}
      >
        <Minus className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      </button>
      <span
        className={cn(
          "min-w-[28px] text-center font-mono font-semibold tabular-nums text-foreground",
          size === "lg" ? "text-[15px]" : "text-[13px]",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase head count"
        className={btn}
        onClick={() => onChange?.(value + 1)}
      >
        <Plus className={size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
      </button>
    </div>
  );
}
