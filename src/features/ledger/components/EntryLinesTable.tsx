import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type JournalEntryDetailLine } from "../types";

/**
 * Entry-viewer lines table (spec §4/§5, FR-LED-006/007). Desktop grid: Line ·
 * Account · Project · Cost centre · Purpose · Godown · Party · Debit ৳ · Credit ৳ ·
 * Narration. A `null` dimension renders as an em-dash (tag matrix, SRS §6) — never an
 * error. Party shown only when set (AR/AP control lines, FR-LED-012). Tablet (≥768)
 * collapses the four dimensions + party into a per-line expander; mobile (<768)
 * degrades to read-only cards — both handled by the parent screen's responsive
 * wrapper; this component renders the ≥768 dense grid. READ-ONLY: no row action.
 */
const GRID = "grid-cols-[44px_1.6fr_1fr_1fr_1fr_1fr_1fr_0.9fr_0.9fr_1.6fr]";

const DASH = <span className="text-faint">—</span>;

function dim(value: string | null): React.ReactNode {
  return value ?? DASH;
}

export function EntryLinesTable({ lines }: { lines: JournalEntryDetailLine[] }) {
  return (
    <div
      role="table"
      aria-label="Journal entry lines"
      className="hidden overflow-x-auto md:block"
      data-testid="entry-lines-table"
    >
      <div role="row" className={cn("grid border-b border-border-strong bg-surface-2", GRID)}>
        <HeaderCell>Line</HeaderCell>
        <HeaderCell>Account</HeaderCell>
        <HeaderCell>Project</HeaderCell>
        <HeaderCell>Cost centre</HeaderCell>
        <HeaderCell>Purpose</HeaderCell>
        <HeaderCell>Godown</HeaderCell>
        <HeaderCell>Party</HeaderCell>
        <HeaderCell align="right">Debit ৳</HeaderCell>
        <HeaderCell align="right">Credit ৳</HeaderCell>
        <HeaderCell>Narration</HeaderCell>
      </div>

      {lines.map((line) => (
        <div
          key={line.id}
          role="row"
          tabIndex={0}
          className={cn("grid items-start border-t border-muted outline-none focus:bg-accent-soft", GRID)}
          data-testid={`entry-line-${line.lineNo}`}
        >
          <div role="cell" tabIndex={0} className="px-4 py-3 text-[13px] tabular-nums text-faint outline-none">
            {line.lineNo}
          </div>
          <div role="cell" tabIndex={0} className="min-w-0 px-4 py-3 text-[13px] text-foreground outline-none">
            {line.accountId}
          </div>
          <div role="cell" tabIndex={0} className="px-4 py-3 text-[12.5px] text-foreground outline-none">
            {dim(line.projectId)}
          </div>
          <div role="cell" tabIndex={0} className="px-4 py-3 text-[12.5px] text-foreground outline-none">
            {dim(line.costCentreId)}
          </div>
          <div role="cell" tabIndex={0} className="px-4 py-3 text-[12.5px] text-foreground outline-none">
            {dim(line.purposeId)}
          </div>
          <div role="cell" tabIndex={0} className="px-4 py-3 text-[12.5px] text-foreground outline-none">
            {dim(line.godownId)}
          </div>
          <div role="cell" tabIndex={0} className="px-4 py-3 text-[12.5px] text-foreground outline-none">
            {dim(line.partyId)}
          </div>
          <div role="cell" tabIndex={0} className="px-4 py-3 text-right outline-none">
            <Money value={line.debit} label="Debit" />
          </div>
          <div role="cell" tabIndex={0} className="px-4 py-3 text-right outline-none">
            <Money value={line.credit} label="Credit" />
          </div>
          <div
            role="cell"
            tabIndex={0}
            className="bn min-w-0 px-4 py-3 text-[12.5px] leading-relaxed text-muted-foreground outline-none"
          >
            {line.narration || DASH}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mobile read-only line cards (<768) — back-office reference (spec §4). */
export function EntryLinesCards({ lines }: { lines: JournalEntryDetailLine[] }) {
  return (
    <div className="flex flex-col gap-2.5 md:hidden" data-testid="entry-lines-cards">
      {lines.map((line) => {
        const isDebit = Number(line.debit) !== 0;
        return (
          <div
            key={line.id}
            className="rounded-card border border-border bg-surface p-3.5 shadow-sm"
            data-testid={`entry-line-card-${line.lineNo}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.4px] text-faint">
                  Line {line.lineNo}
                </span>
                <div className="text-[13.5px] font-semibold text-foreground">{line.accountId}</div>
              </div>
              <div className="flex-none text-right">
                <div className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">
                  {isDebit ? "Debit ৳" : "Credit ৳"}
                </div>
                <Money value={isDebit ? line.debit : line.credit} label={isDebit ? "Debit" : "Credit"} bold />
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-muted pt-2.5">
              <Chip label="Project" value={line.projectId} />
              <Chip label="Cost centre" value={line.costCentreId} />
              <Chip label="Purpose" value={line.purposeId} />
              <Chip label="Godown" value={line.godownId} />
              <Chip label="Party" value={line.partyId} />
            </div>
            {line.narration && (
              <div className="bn mt-2 text-[12px] leading-relaxed text-muted-foreground">{line.narration}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-muted bg-surface-2 px-2 py-1">
      <span className="text-[9px] font-semibold uppercase tracking-[0.3px] text-faint">{label}</span>
      <span className="text-[11.5px] text-foreground">{value ?? DASH}</span>
    </span>
  );
}

function Money({ value, label, bold }: { value: string; label: string; bold?: boolean }) {
  const isZero = Number(value) === 0;
  return (
    <span
      className={cn(
        "font-mono text-[13px] tabular-nums",
        bold ? "font-bold" : "font-semibold",
        isZero ? "text-faint" : "text-foreground",
      )}
      aria-label={`${label} ${formatMoney(value)}`}
    >
      {formatMoney(value, { withSymbol: false })}
    </span>
  );
}

function HeaderCell({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <div
      role="columnheader"
      className={cn(
        "px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {children}
    </div>
  );
}
