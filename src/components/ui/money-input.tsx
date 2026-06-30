import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Money input (design-system §5.1). ৳ adornment + a right-aligned, tabular numeric
 * field. Values are Decimal(18,4) strings handled via lib/money (formatMoney/
 * parseMoney) in the form layer — never a JS number. Presentational here.
 */
export interface MoneyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, invalid, ...props }, ref) => (
    <div className="relative">
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden
      >
        ৳
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        className={cn(
          "h-9 w-full rounded-token border border-border-strong bg-background pl-7 pr-3 text-right text-sm tabular-nums text-foreground",
          "placeholder:text-faint focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
          invalid && "border-destructive focus:border-destructive focus:ring-destructive-soft",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
MoneyInput.displayName = "MoneyInput";
