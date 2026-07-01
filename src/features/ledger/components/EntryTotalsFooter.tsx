import { Badge } from "@/components/ui/badge";
import { formatMoney, toDecimal } from "@/lib/money";

/**
 * Entry-viewer totals footer (spec §5/§8, FR-LED-007/014-adjacent). `total_debit`
 * always equals `total_credit` for a posted entry — rendered as the "Balanced" proof.
 * Exact-decimal comparison (decimal.js, never float) drives the "Balanced" state.
 */
export function EntryTotalsFooter({
  totalDebit,
  totalCredit,
}: {
  totalDebit: string;
  totalCredit: string;
}) {
  const balanced = toDecimal(totalDebit).equals(toDecimal(totalCredit));
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 border-t-2 border-border-strong bg-surface-2 px-4 py-3.5"
      data-testid="entry-totals-footer"
    >
      <div className="flex items-center gap-2.5">
        <Badge tone={balanced ? "success" : "destructive"} dot data-testid="balance-badge">
          {balanced ? "Balanced" : "Out of balance"}
        </Badge>
        <span className="text-[12.5px] text-muted-foreground">Total debit equals total credit</span>
      </div>
      <div className="flex gap-6">
        <TotalCell label="Total debit ৳" value={totalDebit} />
        <TotalCell label="Total credit ৳" value={totalCredit} />
      </div>
    </div>
  );
}

function TotalCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right" data-testid={`total-${label.toLowerCase().includes("debit") ? "debit" : "credit"}`}>
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.4px] text-faint">{label}</div>
      <div
        className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground"
        aria-label={`${label} ${formatMoney(value)}`}
      >
        {formatMoney(value, { withSymbol: false })}
      </div>
    </div>
  );
}
