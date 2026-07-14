"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { type JournalEntry, type JournalEntryLine } from "../api/receipt";
import { useMasterLookups, type MasterLookups } from "@/lib/masters/lookups";

/**
 * Receipt viewer ledger-lines table (spec §5, FR-REC-010/-011; brief §5). Mirrors the
 * LED Entry-viewer pattern with **one structural omission**: no `Godown` column (never
 * applicable to a `RECEIPT` — a customer collection/AR/deposit posting carries no
 * godown; the column is *absent*, not an em-dash cell). Renders whatever the backend
 * wrote — never re-derives balance; never re-orders. Loading / 403 / other-error share
 * the same card shell so the layout is stable. On ≥1024 renders the full 7-column
 * grid; on ≥768 the four-dimension + party columns collapse behind a per-line
 * `Dimensions` expander (`<button>` with `aria-expanded`); on <768 the parent screen
 * renders the mobile stacked-cards variant instead.
 */
const GRID = "grid grid-cols-[40px_1.6fr_1fr_1fr_1fr_1.2fr_0.95fr_0.95fr]";

interface ViewerLine {
  id: string;
  lineNo: number;
  accountLabel: string;
  project: string | null;
  costCentre: string | null;
  purpose: string | null;
  party: string | null;
  isControl: boolean;
  debit: string;
  credit: string;
}

function toViewerLine(line: JournalEntryLine, lookups: MasterLookups): ViewerLine {
  const accountFull = lookups.accountLabel(line.accountId) || line.accountId;
  return {
    id: line.id,
    lineNo: line.lineNo,
    accountLabel: accountFull,
    project: line.projectId ? lookups.project(line.projectId) || line.projectId : null,
    costCentre: line.costCentreId ? lookups.costCentre(line.costCentreId) || line.costCentreId : null,
    purpose: line.purposeId,
    party: line.partyId
      ? lookups.party(line.partyId) || `${line.partyId.slice(0, 8)} (name unavailable)`
      : null,
    isControl: !!line.partyId,
    debit: line.debit,
    credit: line.credit,
  };
}

export function ReceiptLedgerLinesTable({
  entry,
  isLoading,
  errorCode,
  ledgerHref,
  onRetry,
}: {
  entry: JournalEntry | undefined;
  isLoading: boolean;
  errorCode: "FORBIDDEN" | "OTHER" | null;
  ledgerHref: string | null;
  onRetry: () => void;
}) {
  const lookups = useMasterLookups();

  return (
    <section
      className="mt-4 overflow-hidden rounded-card border border-border bg-surface shadow-sm"
      data-testid="receipt-ledger-lines"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-5 py-3.5">
        <h2 className="text-[13px] font-bold text-foreground">Ledger lines</h2>
        <span className="text-[11.5px] text-muted-foreground">The balanced Dr/Cr posting for this receipt.</span>
        {ledgerHref && (
          <Link
            href={ledgerHref}
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink hover:underline"
            data-testid="receipt-view-ledger-entry"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View ledger entry
          </Link>
        )}
      </header>

      {isLoading ? (
        <div className="p-5" data-testid="receipt-ledger-lines-loading">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
              <Skeleton className="h-3 w-6" />
              <Skeleton className="h-3 flex-[2]" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : errorCode === "FORBIDDEN" ? (
        <Alert
          tone="warning"
          className="m-4"
          title="You don't have access to the ledger detail for this receipt."
          data-testid="receipt-ledger-lines-forbidden"
        >
          <span className="text-[12.5px]">
            The receipt header and money figures load with <code>receipts:READ</code>; the balanced
            ledger lines are gated by <code>ledger.journal_entries:READ</code>. Ask an admin to grant it.
          </span>
        </Alert>
      ) : errorCode === "OTHER" ? (
        <Alert
          tone="destructive"
          className="m-4"
          title="Couldn't load the ledger lines. Please try again."
          data-testid="receipt-ledger-lines-error"
        >
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1.5 rounded-token border border-border-strong bg-surface px-3 py-1.5 text-[12px] font-semibold text-foreground hover:bg-surface-2"
            onClick={onRetry}
            data-testid="receipt-ledger-lines-retry"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </Alert>
      ) : entry ? (
        <ReceiptLedgerLinesDesktop
          lines={entry.lines.map((l) => toViewerLine(l, lookups))}
          totalDebit={entry.totalDebit}
          totalCredit={entry.totalCredit}
        />
      ) : null}
    </section>
  );
}

function ReceiptLedgerLinesDesktop({
  lines,
  totalDebit,
  totalCredit,
}: {
  lines: ViewerLine[];
  totalDebit: string;
  totalCredit: string;
}) {
  return (
    <div>
      {/* Desktop grid ≥1024. */}
      <div className={cn(GRID, "hidden bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground lg:grid")} role="row">
        <span className="pl-4">#</span>
        <span>Account</span>
        <span>Project</span>
        <span>Cost centre</span>
        <span>Purpose</span>
        <span>Party</span>
        <span className="pr-4 text-right">Debit</span>
        <span className="pr-4 text-right">Credit</span>
      </div>
      <div className="hidden lg:block">
        {lines.map((l) => (
          <div key={l.id} className={cn(GRID, "border-b border-border py-3.5 text-[13px] text-foreground last:border-b-0")} role="row">
            <span className="pl-4 font-mono text-[12px] text-muted-foreground">{l.lineNo}</span>
            <span className="pr-2 [overflow-wrap:anywhere]">{l.accountLabel}</span>
            <span className="pr-2 text-muted-foreground">{l.project ?? "—"}</span>
            <span className="pr-2 text-muted-foreground">{l.costCentre ?? "—"}</span>
            <span className="pr-2 text-muted-foreground">{l.purpose ?? "—"}</span>
            <span className="bn pr-2 text-muted-foreground [overflow-wrap:anywhere]">{l.party ?? "—"}</span>
            <span className="pr-4 text-right font-mono tabular-nums">{isNonZero(l.debit) ? formatMoney(l.debit) : "—"}</span>
            <span className="pr-4 text-right font-mono tabular-nums">{isNonZero(l.credit) ? formatMoney(l.credit) : "—"}</span>
          </div>
        ))}
        <div className={cn(GRID, "border-t-2 border-border-strong bg-surface-2 py-3 text-[13px] font-bold text-foreground")} role="row">
          <span />
          <span>Totals</span>
          <span /><span /><span /><span />
          <span className="pr-4 text-right font-mono tabular-nums">{formatMoney(totalDebit)}</span>
          <span className="pr-4 text-right font-mono tabular-nums">{formatMoney(totalCredit)}</span>
        </div>
      </div>

      {/* Tablet 768: per-line dimensions expander. */}
      <div className="block lg:hidden">
        {lines.map((l) => (
          <TabletLineRow key={l.id} line={l} />
        ))}
        <div className="flex items-center justify-between gap-3 border-t-2 border-border-strong bg-surface-2 px-4 py-3 text-[13px] font-bold text-foreground">
          <span>Totals</span>
          <span className="font-mono tabular-nums">
            Dr {formatMoney(totalDebit)} · Cr {formatMoney(totalCredit)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TabletLineRow({ line }: { line: ViewerLine }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border py-3 last:border-b-0" data-testid={`receipt-ledger-line-${line.lineNo}`}>
      <div className="flex items-start gap-3 px-4">
        <span className="mt-0.5 font-mono text-[12px] text-muted-foreground">{line.lineNo}</span>
        <span className="flex-1 text-[13px] text-foreground [overflow-wrap:anywhere]">{line.accountLabel}</span>
        <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
          {isNonZero(line.debit) ? `Dr ${formatMoney(line.debit)}` : `Cr ${formatMoney(line.credit)}`}
        </span>
      </div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 px-4 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
        data-testid={`receipt-ledger-line-${line.lineNo}-expander`}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} aria-hidden />
        Dimensions
      </button>
      {open && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 text-[12px] text-muted-foreground">
          <dt className="font-semibold uppercase tracking-[0.3px]">Project</dt>
          <dd>{line.project ?? "—"}</dd>
          <dt className="font-semibold uppercase tracking-[0.3px]">Cost centre</dt>
          <dd>{line.costCentre ?? "—"}</dd>
          <dt className="font-semibold uppercase tracking-[0.3px]">Purpose</dt>
          <dd>{line.purpose ?? "—"}</dd>
          <dt className="font-semibold uppercase tracking-[0.3px]">Party</dt>
          <dd className="bn">{line.party ?? "—"}</dd>
        </dl>
      )}
    </div>
  );
}

function isNonZero(v: string): boolean {
  return !!v && Number(v) !== 0;
}

