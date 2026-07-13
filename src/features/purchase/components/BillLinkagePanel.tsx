"use client";

import Link from "next/link";
import { ExternalLink, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type JournalEntryDetail } from "@/features/ledger/types";

/**
 * Bill-viewer linkage panel (brief §Scope 9; FR-PUR-022, FR-PUR-023). Renders the LED
 * entry's reversal linkage: "Reversal of {entryNo}" when this bill's entry is a
 * reversal, "Reversed by {entryNo}" (from the derived `reversedBy`) when a later
 * cancel/repost references it, else the "No reversal" state. Each entry link opens
 * the LED Entry viewer for the canonical balanced-line detail; a missing target
 * degrades to plain text + "(unavailable)".
 */
export function BillLinkagePanel({
  entry,
  billEntryNo,
}: {
  entry: JournalEntryDetail | null;
  billEntryNo: string | null;
}) {
  let linkLabel = "No reversal";
  let linkTarget: { id: string; entryNo: string } | null = null;

  if (entry?.isReversal && entry.reversalOf) {
    linkLabel = "Reversal of";
    linkTarget = { id: entry.reversalOf, entryNo: entry.reversalOf };
  } else if (entry?.isReversed && entry.reversedBy) {
    linkLabel = "Reversed by";
    linkTarget = { id: entry.reversedBy.entryId, entryNo: entry.reversedBy.entryNo };
  }

  return (
    <Card className="p-4" data-testid="bill-linkage-panel">
      <div className="flex items-center gap-3">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-token bg-muted text-muted-foreground">
          <Repeat className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Reversal linkage
          </div>
          <div className="text-[13.5px] font-semibold text-foreground">{linkLabel}</div>
          {linkTarget ? (
            <Link
              href={`/ledger/entry-viewer?id=${linkTarget.id}`}
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-[12.5px] text-info hover:underline"
              aria-label={`${linkLabel} entry ${linkTarget.entryNo}`}
            >
              {linkTarget.entryNo}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          ) : (
            <span className="mt-0.5 text-[12.5px] text-faint">
              {billEntryNo ? `Bill entry ${billEntryNo} has not been reversed.` : "This bill has no reversal history."}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
