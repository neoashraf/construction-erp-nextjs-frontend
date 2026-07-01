import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { EntryStatusBadge } from "./EntryStatusBadge";
import { type JournalEntryDetail, entryStatus, voucherTypeLabel } from "../types";

/**
 * Entry-viewer header block (spec §5, FR-LED-005). Entry no, voucher-type badge,
 * voucher date (DD/MM/YYYY), FY label, status badge (Normal/Reversal/Reversed),
 * posted at/by, narration, and the immutability note (FR-LED-024) — text only, no
 * edit/delete/void affordance renders here or anywhere else on this screen.
 */
export function EntryHeaderBlock({
  entry,
  fyLabel,
}: {
  entry: JournalEntryDetail;
  fyLabel: string;
}) {
  const status = entryStatus(entry);
  return (
    <Card className="mt-4 overflow-hidden" data-testid="entry-header">
      <div className="flex flex-wrap items-start gap-7 p-5">
        <Field label="Entry no.">
          <span className="font-mono text-sm font-medium text-foreground">{entry.entryNo}</span>
        </Field>
        <Field label="Voucher type">
          <Badge tone="neutral" data-testid="voucher-type-badge">
            {voucherTypeLabel(entry.voucherType)}
          </Badge>
        </Field>
        <Field label="Voucher date">
          <span className="tabular-nums text-sm text-foreground">{formatDate(entry.voucherDate)}</span>
        </Field>
        <Field label="Financial year">
          <span className="text-sm text-foreground">{fyLabel}</span>
        </Field>
        <Field label="Status">
          <EntryStatusBadge status={status} />
        </Field>
        <div className="ml-auto flex flex-col items-end gap-1 text-right">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
            Posted
          </span>
          <span className="text-[13px] tabular-nums text-foreground">{formatDateTime(entry.postedAt)}</span>
          <span className="bn text-[12.5px] text-muted-foreground">
            {entry.postedBy ? (
              `by ${entry.postedBy}`
            ) : (
              <span className="text-faint">(name unavailable)</span>
            )}
          </span>
        </div>
      </div>

      {/* Narration */}
      <div className="border-t border-muted px-5 py-4">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          Narration
        </span>
        <div className="bn mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
          {entry.narration || <span className="text-faint">—</span>}
        </div>
      </div>

      {/* Immutability note (FR-LED-024) — text only, in reading order near the header */}
      <div
        className="flex items-center gap-2.5 border-t border-muted bg-surface-2 px-5 py-3"
        data-testid="immutability-note"
      >
        <Badge tone="neutral" className="uppercase tracking-[0.5px]">
          Read-only
        </Badge>
        <span className="text-[12.5px] leading-relaxed text-muted-foreground">
          Posted entries can&rsquo;t be edited. To correct this, reverse or repost the source voucher.
        </span>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
