import Link from "next/link";
import { ExternalLink, FileText, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { type JournalEntryDetail } from "../types";

/**
 * Entry-viewer linkage panel (spec §5/§9, FR-LED-030/026). Two cards: the source
 * voucher (`source_type`/`source_id` → originating voucher) and the reversal
 * linkage — "Reversal of {entry_no}" when `isReversal`, "Reversed by {entry_no}"
 * (from the derived `reversedBy`) when `isReversed`, else "No reversal" (a normal
 * entry has no linkage to show, but the card still renders so the panel layout is
 * stable). Each entry link opens the linked entry in this same viewer (client nav);
 * an unresolvable/missing target degrades to plain text + "(unavailable)" (spec §6
 * partial state) instead of erroring.
 */
function entryHref(id: string): string {
  return `/ledger/entry-viewer?id=${id}`;
}
function sourceHref(sourceType: string | null, sourceId: string | null): string | null {
  if (!sourceType || !sourceId) return null;
  return `/vouchers/${sourceType.toLowerCase()}/${sourceId}`;
}

export function EntryLinkagePanel({ entry }: { entry: JournalEntryDetail }) {
  const src = sourceHref(entry.sourceType, entry.sourceId);

  let linkLabel = "No reversal";
  let linkTarget: { id: string; entryNo: string } | null = null;
  if (entry.isReversal && entry.reversalOf) {
    linkLabel = "Reversal of";
    linkTarget = { id: entry.reversalOf, entryNo: entry.reversalOf };
  } else if (entry.isReversed && entry.reversedBy) {
    linkLabel = "Reversed by";
    linkTarget = { id: entry.reversedBy.entryId, entryNo: entry.reversedBy.entryNo };
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="entry-linkage-panel">
      {/* Source voucher */}
      <Card className="p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Source voucher
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-token bg-info-soft text-info-ink">
            <FileText className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            {entry.sourceType ? (
              <>
                <div className="text-[13.5px] font-semibold text-foreground">Source: {entry.sourceType}</div>
                {src ? (
                  <Link
                    href={src}
                    className="inline-flex items-center gap-1 font-mono text-[12.5px] text-info hover:underline"
                    aria-label={`View source voucher ${entry.sourceId}`}
                  >
                    {entry.sourceId}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                ) : (
                  <span className="font-mono text-[12.5px] text-faint">{entry.sourceId} (unavailable)</span>
                )}
              </>
            ) : (
              <span className="text-[13px] text-faint">—</span>
            )}
          </div>
        </div>
      </Card>

      {/* Reversal linkage */}
      <Card className="p-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Reversal linkage
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-token bg-muted text-muted-foreground">
            <Repeat className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-foreground">{linkLabel}</div>
            {linkTarget ? (
              <Link
                href={entryHref(linkTarget.id)}
                className="inline-flex items-center gap-1 font-mono text-[12.5px] text-info hover:underline"
                aria-label={`${linkLabel} entry ${linkTarget.entryNo}`}
              >
                {linkTarget.entryNo}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            ) : (
              <span className="text-[12.5px] text-faint">This entry has not been reversed.</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
