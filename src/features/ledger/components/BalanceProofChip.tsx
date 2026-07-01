import { Check } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { type TrialBalanceTotals } from "../types";

/**
 * Balance-proof chip (spec §5/§8; design file header pill; FR-LED-014). Renders the
 * exact microcopy "Balanced — ৳ {debit} Dr / ৳ {credit} Cr" from `totals.debit` /
 * `totals.credit` — always equal for a posted, balanced ledger. This is a proof
 * display, not a computation: the FE asserts equality for the "Balanced" wording,
 * it never derives the totals itself (server-computed, FR-LED-007 exact money).
 */
export function BalanceProofChip({ totals, className }: { totals: TrialBalanceTotals; className?: string }) {
  const balanced = totals.debit === totals.credit;
  return (
    <span
      className={cn(
        "inline-flex h-[27px] items-center gap-2 rounded-pill border px-3",
        balanced ? "border-success-soft bg-success-soft" : "border-destructive-soft bg-destructive-soft",
        className,
      )}
      data-testid="balance-proof-chip"
      data-balanced={balanced}
    >
      <span
        className={cn(
          "grid h-3.5 w-3.5 place-items-center rounded-full text-[9px] font-bold text-white",
          balanced ? "bg-success" : "bg-destructive",
        )}
      >
        {balanced ? <Check className="h-2.5 w-2.5" aria-hidden /> : "!"}
      </span>
      <span className={cn("text-xs font-semibold", balanced ? "text-success-ink" : "text-destructive-ink")}>
        {balanced ? "Balanced" : "Out of balance"} —{" "}
        <span className="font-mono tabular-nums">{formatMoney(totals.debit)}</span> Dr /{" "}
        <span className="font-mono tabular-nums">{formatMoney(totals.credit)}</span> Cr
      </span>
    </span>
  );
}
