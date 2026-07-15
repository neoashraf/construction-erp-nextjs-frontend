"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Head-count `−`/count/`＋` stepper (Attendance.dc.html daily-labour + subcontractor rows).
 * A visually-hidden number input keeps the control keyboard-typable and gives it a real
 * `spinbutton` role (assistive tech + `getByRole("spinbutton")` in tests) while the buttons
 * cover the click path the mockup shows.
 */
export function HeadCountStepper({
  value,
  onChange,
  disabled,
  min = 0,
  testId,
  label = "Head count",
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  min?: number;
  testId?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex h-[34px] items-center rounded-token border border-border-strong bg-surface",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label="Decrease head count"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid h-full w-[26px] place-items-center rounded-l-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <input
        type="number"
        aria-label={label}
        value={value}
        disabled={disabled}
        min={min}
        step={1}
        data-testid={testId}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="h-full w-9 min-w-0 border-x border-border bg-transparent text-center font-mono text-[13px] font-semibold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Increase head count"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="grid h-full w-[26px] place-items-center rounded-r-token text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
