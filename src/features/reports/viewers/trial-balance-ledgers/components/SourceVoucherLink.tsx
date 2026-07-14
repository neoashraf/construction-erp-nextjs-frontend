import Link from "next/link";
import { cn } from "@/lib/utils";
import { type LedgerRow } from "../types";

/**
 * FE-56 source-voucher link (spec §5/§9). Resolves the LED Entry viewer route
 * from `journalEntryId` (preferred) or a `sourceType`/`sourceId` pair. When
 * neither is available the entry number renders as plain text (partial state).
 * Independently focusable, with a descriptive accessible name.
 */
export function SourceVoucherLink({ row }: { row: LedgerRow }) {
  const href = resolveHref(row);
  const label = row.entryNo;
  const accessibleName = `Open entry ${label}`;
  if (!href) {
    return (
      <span data-testid="source-voucher-link" data-resolved="false" className="text-muted-foreground">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "font-semibold text-accent-ink hover:underline",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1",
      )}
      aria-label={accessibleName}
      data-testid="source-voucher-link"
      data-resolved="true"
    >
      {label}
    </Link>
  );
}

function resolveHref(row: LedgerRow): string | null {
  if (row.journalEntryId) return `/ledger/journal-entries/${row.journalEntryId}`;
  if (row.sourceType && row.sourceId) {
    return `/ledger/journal-entries?source=${encodeURIComponent(row.sourceType)}/${encodeURIComponent(row.sourceId)}`;
  }
  return null;
}
