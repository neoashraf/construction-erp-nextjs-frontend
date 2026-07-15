"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { type OpeningLine } from "../api/opening";

/**
 * Derived-lines review table (spec §5). Read-only — grouped by section headings
 * (Account balances · Party balances (AR/AP) · Opening balance equity) with a
 * balanced totals footer. Corrections happen on the MAS master, not here (spec §7).
 */
const GRID = "grid grid-cols-[60px_1.6fr_1fr_1fr_1fr] gap-2";

export function OpeningLinesReviewTable({
  lines,
  totalDebit,
  totalCredit,
  balanced,
}: {
  lines: OpeningLine[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}) {
  const groups = groupBySection(lines);
  return (
    <div
      className="overflow-hidden rounded-card border border-border bg-surface"
      data-testid="opening-lines-review"
    >
      <div className={cn(GRID, "bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground")}>
        <span className="pl-4">Line</span>
        <span>Account / Party</span>
        <span>Type</span>
        <span className="pr-4 text-right">Debit</span>
        <span className="pr-4 text-right">Credit</span>
      </div>

      {(["ACCOUNT", "PARTY_AR", "PARTY_AP", "EQUITY"] as OpeningLine["section"][])
        .filter((s) => groups[s]?.length)
        .map((section) => (
          <section key={section} role="rowgroup" data-testid={`opening-group-${section}`}>
            <h2 className="sticky top-0 z-10 border-y border-border bg-surface-2/80 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.4px] text-foreground backdrop-blur">
              {SECTION_LABEL[section]}
            </h2>
            {groups[section]!.map((l) => (
              <div
                key={l.lineNo}
                className={cn(GRID, "border-b border-border py-3 text-[13px] text-foreground last:border-b-0")}
                role="row"
                data-testid={`opening-line-${l.lineNo}`}
              >
                <span className="pl-4 font-mono text-[12px] text-muted-foreground">{l.lineNo}</span>
                <span className="bn [overflow-wrap:anywhere]">
                  {l.accountLabel}
                  {l.partyLabel ? <span className="ml-1 text-muted-foreground">· {l.partyLabel}</span> : null}
                </span>
                <span className="text-muted-foreground">{TYPE_LABEL[l.section]}</span>
                <span className="pr-4 text-right font-mono tabular-nums">{isNonZero(l.debit) ? formatMoney(l.debit) : "—"}</span>
                <span className="pr-4 text-right font-mono tabular-nums">{isNonZero(l.credit) ? formatMoney(l.credit) : "—"}</span>
              </div>
            ))}
          </section>
        ))}

      <div className={cn(GRID, "border-t-2 border-border-strong bg-surface-2 py-3 text-[13px] font-bold text-foreground")}>
        <span />
        <span className="pl-4 flex items-center gap-2">
          {balanced ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1 text-[12px] font-semibold text-success-ink" data-testid="opening-balanced-ok">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Balanced
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-destructive-soft px-3 py-1 text-[12px] font-semibold text-destructive-ink" data-testid="opening-balanced-off">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              Out of balance
            </span>
          )}
        </span>
        <span>Totals</span>
        <span className="pr-4 text-right font-mono tabular-nums">{formatMoney(totalDebit)}</span>
        <span className="pr-4 text-right font-mono tabular-nums">{formatMoney(totalCredit)}</span>
      </div>
    </div>
  );
}

const SECTION_LABEL: Record<OpeningLine["section"], string> = {
  ACCOUNT: "Account balances",
  PARTY_AR: "Party balances — Accounts Receivable",
  PARTY_AP: "Party balances — Accounts Payable",
  EQUITY: "Opening balance equity",
};

const TYPE_LABEL: Record<OpeningLine["section"], string> = {
  ACCOUNT: "Account opening",
  PARTY_AR: "AR",
  PARTY_AP: "AP",
  EQUITY: "Equity",
};

function groupBySection(lines: OpeningLine[]): Record<OpeningLine["section"], OpeningLine[]> {
  const g: Record<OpeningLine["section"], OpeningLine[]> = { ACCOUNT: [], PARTY_AR: [], PARTY_AP: [], EQUITY: [] };
  for (const l of lines) g[l.section].push(l);
  return g;
}

function isNonZero(v: string): boolean {
  return !!v && Number(v) !== 0;
}
