"use client";

import Link from "next/link";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * The confirmed / reversed pill on a daily-labour row (FR-HR-012). "Confirmed — {entryNo}"
 * is textual (not colour-only, spec §10) and the entryNo is a link to the LED Entry viewer.
 * When a row is reversed the badge picks up the "Reversed" tone and points at the reversal
 * entry; the original row keeps its locked styling.
 */
export function ConfirmedRowBadge({
  entryNo,
  journalEntryId,
  reversalEntryNo,
  reversalEntryId,
}: {
  entryNo: string | null | undefined;
  journalEntryId?: string | null;
  reversalEntryNo?: string | null;
  reversalEntryId?: string | null;
}) {
  const reversed = !!reversalEntryNo;
  return (
    <span className="inline-flex items-center gap-1.5" data-testid="confirmed-badge">
      <Badge tone={reversed ? "neutral" : "success"} dot>
        {reversed ? (
          <RotateCcw className="h-3 w-3" aria-hidden />
        ) : (
          <CheckCircle2 className="h-3 w-3" aria-hidden />
        )}
        <span className="sr-only">Confirmed — </span>
        {entryNo ? (
          <Link
            href={`/ledger/entry-viewer?id=${encodeURIComponent(journalEntryId ?? entryNo)}`}
            className="font-mono underline-offset-2 hover:underline"
            data-testid="confirmed-entryno-link"
          >
            {entryNo}
          </Link>
        ) : (
          <span>Confirmed</span>
        )}
      </Badge>
      {reversed && (
        <Badge tone="warning" data-testid="reversed-badge">
          Reversed
          {reversalEntryNo && (
            <Link
              href={`/ledger/entry-viewer?id=${encodeURIComponent(reversalEntryId ?? reversalEntryNo)}`}
              className="ml-1 font-mono underline-offset-2 hover:underline"
              data-testid="reversed-entryno-link"
            >
              {reversalEntryNo}
            </Link>
          )}
        </Badge>
      )}
    </span>
  );
}
