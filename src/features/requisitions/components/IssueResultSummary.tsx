import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { formatMoney, formatQty } from "@/lib/money";
import { type ItemOption, type RequisitionIssue } from "../types";

/**
 * Post-success issue-result panel (spec §5A/§8; FR-REQ-013/-014). Renders the gapless
 * `STOCK_JOURNAL` `entryNo`, the posted `issuedValue`, and each line's server-computed
 * `rate`/`value` — the weighted average at the moment of issue, never entered by hand. Links
 * into the consumption ledger entry. The posting itself (`Dr material expense / Cr inventory`)
 * is server-internal; this only reports the returned result.
 */
export function IssueResultSummary({
  result,
  lineItems,
}: {
  result: RequisitionIssue;
  /** requisitionLineId → the line's item (built from the requisition lines by the detail). */
  lineItems: Map<string, ItemOption>;
}) {
  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-success-soft"
      data-testid="req-issue-result"
    >
      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
        <CheckCircle2 className="h-5 w-5 flex-none text-success" aria-hidden />
        <p className="text-[14px] font-semibold text-success-ink">
          Issued — entry {result.entryNo}, value {formatMoney(result.issuedValue)}.
        </p>
        <Link
          href={`/ledger/entry-viewer?id=${result.journalEntryId}`}
          className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-accent-ink hover:underline"
          data-testid="req-issue-result-entry"
        >
          View stock journal
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      <div className="border-t border-success/20 bg-surface/60 px-5 py-3">
        {result.lines.map((l) => {
          const item = lineItems.get(l.requisitionLineId);
          return (
            <div
              key={l.requisitionLineId}
              className="flex items-center justify-between gap-3 py-1 text-[13px]"
            >
              <span className="min-w-0 [overflow-wrap:anywhere] text-foreground">
                {item?.name ?? l.requisitionLineId.slice(0, 8)}: {formatQty(l.issuedQuantity, 4)}{" "}
                <span className="text-muted-foreground">{item?.uom ?? ""}</span> @{" "}
                {formatMoney(l.rate)}
              </span>
              <span className="whitespace-nowrap font-mono tabular-nums font-medium text-foreground">
                {formatMoney(l.value)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="border-t border-success/20 px-5 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
        Rate and value are the server-computed weighted average at the moment of issue — never
        entered by hand. The consumption{" "}
        <span className="font-semibold text-foreground">Dr material expense / Cr inventory</span>{" "}
        posted internally under this entry.
      </p>
    </div>
  );
}
