"use client";

import { formatMoney } from "@/lib/money";
import { latePenaltyHelper, latePenaltyLabel } from "../schemas/payslip.schema";

/**
 * The FR-HR-013a late-penalty row (spec §5/§8/§10; decision record §8.3).
 *
 * Lives at the HEAD of the Earnings block, immediately above "Gross salary" — never under
 * Deductions: a post-gross deduction would need a GL account to credit and none exists, so
 * placing it there would make the document contradict the journal behind it. The row is
 * EXPLANATORY, not arithmetic — `grossAmount` is already net of the penalty, and the
 * amount joins no subtotal.
 *
 * The amount carries an explicit "minus" accessible label: a leading `−` glyph is
 * routinely dropped by screen readers, and this is the one figure on the document a
 * person is most likely to dispute. The label is the longest string on the document and
 * wraps rather than clips — the reason is the entire purpose of the line.
 */
export function LatePenaltyLine({
  lateCount,
  latePenaltyDays,
  latePenaltyAmount,
  latesPerDeductedDay,
}: {
  lateCount: number;
  latePenaltyDays: string;
  latePenaltyAmount: string;
  /** Company divisor for the helper sub-line — undefined until the setting resolves. */
  latesPerDeductedDay?: number;
}) {
  const label = latePenaltyLabel(lateCount, latePenaltyDays);
  const amount = formatMoney(latePenaltyAmount, { withSymbol: false });
  return (
    <div
      className="-mx-2 mb-1 rounded-token bg-destructive-soft px-2 py-2"
      data-testid="payslip-late-penalty"
    >
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <dt className="min-w-0 whitespace-normal [overflow-wrap:anywhere] font-semibold text-destructive-ink">
          {label}
        </dt>
        <dd
          className="flex-none font-mono font-semibold tabular-nums text-destructive-ink"
          aria-label={`Late penalty, minus ৳${amount}`}
        >
          −৳ {amount}
        </dd>
      </div>
      {latesPerDeductedDay != null ? (
        <p className="mt-0.5 text-[10.5px] leading-snug text-destructive-ink/85">
          {latePenaltyHelper(latesPerDeductedDay)}
        </p>
      ) : null}
    </div>
  );
}
