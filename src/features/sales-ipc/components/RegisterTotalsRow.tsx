"use client";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type IpcRegisterTotals } from "../types";

/**
 * Pinned totals row for the register (spec §5 "Totals row (pinned)", §10 a11y). Project-
 * lifetime (or FY-scoped) sums of the register's money columns — `totals.{certified,
 * billedDue, retainedHeld, advanceRecovered, received, outstanding}` — the "billing-vs-
 * certified" headline (FR-SAL-015). Carries an aria "Totals" cue so it's announced (not
 * weight/colour alone). The grid template must match `IpcRegisterTable`'s.
 */
const MONEY = "whitespace-nowrap font-mono text-[12px] tabular-nums";

function money(v: string): string {
  return formatMoney(v, { withSymbol: false, fractionDigits: 2 });
}

export function RegisterTotalsRow({ totals, gridTemplate }: { totals: IpcRegisterTotals; gridTemplate: string }) {
  return (
    <div
      role="row"
      aria-label="Totals"
      data-testid="reg-totals"
      className="sticky bottom-0 z-[1] grid items-center border-t-2 border-border-strong bg-surface-2"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.4px] text-foreground">Totals</div>
      <TotalsCell label="Certified" value={totals.certified} />
      <TotalsCell label="Currently due" value={totals.billedDue} strong />
      <TotalsCell label="Retention (gross)" value={totals.retainedHeld} />
      <TotalsCell label="Advance recovered" value={totals.advanceRecovered} />
      <TotalsCell label="Received" value={totals.received} />
      <TotalsCell label="Outstanding" value={totals.outstanding} strong tone="outstanding" />
      {/* Cumulative columns show — under totals — an em-dash (they are already project-level sums). */}
      <div className="border-l border-border px-2 py-2.5 text-right text-[11px] text-faint" aria-hidden>—</div>
      <div className="px-2 py-2.5 text-right text-[11px] text-faint" aria-hidden>—</div>
      <div className="px-2 py-2.5 text-right text-[11px] text-faint" aria-hidden>—</div>
      <div className="px-2 py-2.5 text-right text-[11px] text-faint" aria-hidden>—</div>
      <div className="px-2 py-2.5 text-right text-[11px] text-faint" aria-hidden>—</div>
    </div>
  );
}

function TotalsCell({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "outstanding";
}) {
  return (
    <div className="px-2 py-2.5 text-right">
      <span
        aria-label={`${label} ৳ ${money(value)}`}
        className={cn(
          MONEY,
          strong ? "font-semibold text-foreground" : "text-muted-foreground",
          tone === "outstanding" && Number(value) > 0 && "text-warning-ink",
          tone === "outstanding" && Number(value) === 0 && "text-success-ink",
        )}
      >
        {money(value)}
      </span>
    </div>
  );
}
