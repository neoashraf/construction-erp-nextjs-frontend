"use client";

import { cn } from "@/lib/utils";

/**
 * Two-option pill toggle (Employees.dc.html detail mockup — Work base / Wage type).
 * A real `role="radiogroup"` of `role="radio"` buttons so it's keyboard/AT-equivalent
 * to a native select, styled as the design's sliding-pill segmented control.
 */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  value: T | "";
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  "aria-label": string;
  "data-testid"?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid={testId}
      className={cn(
        "flex h-9 gap-0.5 rounded-token bg-muted p-[3px]",
        disabled && "opacity-60",
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            data-testid={testId ? `${testId}-${opt.value}` : undefined}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-sm text-[12.5px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed",
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
