"use client";

import Link from "next/link";
import { ArrowUpRight, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABEL, sourceHref } from "../schemas/stock-ledger.schema";
import { type StockMovementSourceType } from "../types";

/** Per-source-type pill tone — text label always present, never colour alone (spec §10). */
const SOURCE_TONE: Record<StockMovementSourceType, string> = {
  STOCK_JOURNAL: "bg-accent-soft text-accent-ink",
  GRN: "bg-info-soft text-info-ink",
  REQ_ISSUE: "bg-warning-soft text-warning-ink",
};

/**
 * A movement's Source cell (spec §5/§8; FR-INV-006): a tinted badge linking to the
 * originating voucher's read view — Stock Journal viewer for `STOCK_JOURNAL`, the PUR/REQ
 * screen for `GRN`/`REQ_ISSUE` (out of scope here). An unresolved source (no id / scoped
 * out) renders as plain "(view unavailable)" text, not a broken link (spec §6 partial).
 * A reversal adds a neutral "Reversal" badge alongside — never edits the original row.
 */
export function SourceLink({
  sourceType,
  sourceId,
  isReversal,
}: {
  sourceType: StockMovementSourceType;
  sourceId: string | null;
  isReversal: boolean;
}) {
  const href = sourceHref(sourceType, sourceId);
  const label = SOURCE_LABEL[sourceType];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {href ? (
        <Link
          href={href}
          data-testid={`sl-source-${sourceType}`}
          className={cn(
            "inline-flex h-5 items-center gap-1 rounded-pill px-2 text-[10.5px] font-semibold hover:underline",
            SOURCE_TONE[sourceType],
          )}
        >
          {label}
          <ArrowUpRight className="h-3 w-3" aria-hidden />
        </Link>
      ) : (
        <span
          data-testid={`sl-source-unavailable`}
          className="inline-flex h-5 items-center gap-1 rounded-pill bg-muted px-2 text-[10.5px] font-semibold text-muted-foreground"
        >
          {label} <span className="font-normal text-faint">(view unavailable)</span>
        </span>
      )}
      {isReversal && (
        <span
          data-testid="sl-reversal-badge"
          className="inline-flex h-5 items-center gap-1 rounded-pill bg-muted px-2 text-[10.5px] font-semibold text-muted-foreground"
        >
          <Undo2 className="h-3 w-3" aria-hidden />
          Reversal
        </span>
      )}
    </div>
  );
}
