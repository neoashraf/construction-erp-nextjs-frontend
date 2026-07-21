"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useMergedGuardRef, useNumericGuard } from "@/components/ui/use-numeric-guard";
import { MONEY_SCALE } from "@/lib/money";

/**
 * Money input (design-system §5.1). ৳ adornment + a right-aligned, tabular numeric
 * field. Values are Decimal(18,4) strings handled via lib/money (formatMoney/
 * parseMoney) in the form layer — never a JS number.
 *
 * Keystrokes/paste are HARD-BLOCKED to a numeric shape via the shared numeric guard
 * (decimal, ≤4 places, grouping-tolerant so `৳ 1,234.56` pastes cleanly) — a letter
 * never lands in the field. Zod still validates the final amount at submit.
 */
export interface MoneyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, invalid, ...props }, ref) => {
    const guardRef = useNumericGuard({
      mode: "decimal",
      decimalPlaces: MONEY_SCALE,
      allowGrouping: true,
    });
    const setRef = useMergedGuardRef(guardRef, ref);

    return (
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
          aria-hidden
        >
          ৳
        </span>
        <input
          ref={setRef}
          inputMode="decimal"
          aria-invalid={invalid || undefined}
          className={cn(
            "h-9 w-full rounded-token border border-border-strong bg-background pl-7 pr-3 text-right text-sm tabular-nums text-foreground",
            "placeholder:text-faint focus:border-accent focus:outline-none focus:shadow-focus",
            "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
            invalid && "border-destructive focus:border-destructive focus:shadow-focus-error",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";
