"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type JournalEntryDetail } from "@/features/ledger/types";

/**
 * Bill-viewer reversal / repost linkage card (brief §Scope 9; FR-PUR-022, FR-PUR-023;
 * Purchase Bill.dc.html viewer). Renders the LED entry's reversal linkage: "Reversal of
 * {entryNo}" when this bill's entry is itself a reversal, "Reversed by {entryNo}" (from the
 * derived `reversedBy`) when a later cancel/repost references it, else the neutral "Not
 * reversed" state. Each entry link opens the LED Entry viewer for the canonical balanced-line
 * detail; a missing target degrades to plain text.
 */
export function BillLinkagePanel({ entry }: { entry: JournalEntryDetail | null }) {
  let title = "Not reversed";
  let subtitle = "No correction linked to this bill.";
  let linkTarget: { id: string; entryNo: string } | null = null;

  if (entry?.isReversal && entry.reversalOf) {
    title = "Reversal of";
    subtitle = "This bill is a correction of an earlier entry.";
    linkTarget = { id: entry.reversalOf, entryNo: entry.reversalOf };
  } else if (entry?.isReversed && entry.reversedBy) {
    title = "Reversed by";
    subtitle = "A later correction reversed this bill.";
    linkTarget = { id: entry.reversedBy.entryId, entryNo: entry.reversedBy.entryNo };
  }

  return (
    <Card className="px-[18px] py-4" data-testid="bill-linkage-panel">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        Reversal / repost linkage
      </div>
      <div className="mt-[11px] flex items-center gap-2.5">
        <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-token bg-muted text-faint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium text-foreground">{title}</div>
          {linkTarget ? (
            <Link
              href={`/ledger/entry-viewer?id=${linkTarget.id}`}
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-[12.5px] text-info hover:underline"
              aria-label={`${title} entry ${linkTarget.entryNo}`}
            >
              {linkTarget.entryNo}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          ) : (
            <div className="text-[11.5px] text-faint">{subtitle}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
