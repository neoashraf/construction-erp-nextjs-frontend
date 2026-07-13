"use client";

import { useMemo } from "react";
import { formatMoney, toDecimal } from "@/lib/money";

/**
 * Live computed daily-labour cost cell — read-only display of `headCount × dailyRate` in
 * exact Decimal(18,4) (never client-round, never JS float — CLAUDE.md "Exact money").
 * Rendered per row in the daily-labour grid; the Confirm dialog re-computes it into
 * the balanced preview.
 */
export function ComputedCostCell({
  headCount,
  dailyRate,
  className,
}: {
  headCount: number | string | null | undefined;
  dailyRate: string | null | undefined;
  className?: string;
}) {
  const value = useMemo(() => {
    try {
      const hc = typeof headCount === "number" ? headCount : Number(headCount ?? 0);
      if (!Number.isFinite(hc) || hc < 0) return "0.0000";
      const rate = toDecimal(dailyRate ?? "0");
      return rate.times(hc).toFixed(4);
    } catch {
      return "0.0000";
    }
  }, [headCount, dailyRate]);
  return (
    <span
      className={"whitespace-nowrap font-mono tabular-nums " + (className ?? "")}
      data-testid="computed-cost"
      data-value={value}
    >
      {formatMoney(value, { withSymbol: false, fractionDigits: 4 })}
    </span>
  );
}
