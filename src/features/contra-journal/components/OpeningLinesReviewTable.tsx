"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { type OpeningLine } from "../api/opening";

/**
 * Derived-lines review table (spec §5; design "Opening Journal.dc.html"). Read-only —
 * grouped by section headings (Account balances · Party balances (AR/AP) · Opening
 * balance equity) with a balanced totals footer. Corrections happen on the MAS
 * master, not here (spec §7).
 *
 * KNOWN GAP: the design's TYPE column also distinguishes an account line's natural
 * classification (Asset/Liability/Equity — e.g. "1001 Cash in hand" tagged "Asset",
 * "2100 Term Loan" tagged "Liability") and flags a party carrying BOTH an AR and an
 * AP line with a "BOTH ROLES" chip. `OpeningLine` (api/opening.ts; the mock-only
 * `/journal/opening/preview` shim, itself flagged PENDING per SRS §15/§16) has no
 * `accountType` field and `accountLabel` is a pre-formatted display string with no
 * `accountId` to join back to the accounts master — so this component can only
 * render the AR-vs-AP / equity distinction it already has (`section`), not the
 * finer Asset/Liability split or the both-roles chip, without either a contract
 * change (an `accountType` + `accountId` on `OpeningLine`) or a party-level rollup
 * the backend would need to compute. Flagged, not fabricated.
 */
const GRID = "grid grid-cols-[60px_1.6fr_1fr_1fr_1fr] gap-2";

const TYPE_TONE: Record<OpeningLine["section"], "info" | "success" | "destructive" | "accent"> = {
  ACCOUNT: "info",
  PARTY_AR: "success",
  PARTY_AP: "destructive",
  EQUITY: "accent",
};

const TYPE_LABEL: Record<OpeningLine["section"], string> = {
  ACCOUNT: "Account",
  PARTY_AR: "AR control",
  PARTY_AP: "AP control",
  EQUITY: "Equity",
};

const SECTION_LABEL: Record<"ACCOUNT" | "PARTY" | "EQUITY", { title: string; sub: string }> = {
  ACCOUNT: { title: "Account balances", sub: "one row per non-zero account opening balance, on its natural side" },
  PARTY: { title: "Party balances (AR / AP)", sub: "AR = party owes the company · AP = the company owes the party" },
  EQUITY: { title: "Opening balance equity", sub: "the single balancing line that nets the entry to zero" },
};

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
  const account = lines.filter((l) => l.section === "ACCOUNT");
  const party = lines.filter((l) => l.section === "PARTY_AR" || l.section === "PARTY_AP");
  const equity = lines.filter((l) => l.section === "EQUITY");
  const groups: { key: "ACCOUNT" | "PARTY" | "EQUITY"; rows: OpeningLine[] }[] = [
    { key: "ACCOUNT", rows: account },
    { key: "PARTY", rows: party },
    { key: "EQUITY", rows: equity },
  ];

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

      {groups
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <section key={g.key} role="rowgroup" data-testid={`opening-group-${g.key}`}>
            <div className="sticky top-0 z-10 border-y border-border bg-surface-2/80 px-4 py-2 backdrop-blur">
              <h2 className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-foreground">{SECTION_LABEL[g.key].title}</h2>
              <p className="mt-0.5 text-[11px] normal-case tracking-normal text-muted-foreground">{SECTION_LABEL[g.key].sub}</p>
            </div>
            {g.rows.map((l) => (
              <div
                key={l.lineNo}
                className={cn(GRID, "items-center border-b border-border py-3 text-[13px] text-foreground last:border-b-0")}
                role="row"
                data-testid={`opening-line-${l.lineNo}`}
              >
                <span className="pl-4 font-mono text-[12px] text-muted-foreground">{l.lineNo}</span>
                <span className="bn [overflow-wrap:anywhere]">
                  <span>{l.accountLabel}</span>
                  {l.partyLabel ? <span className="block text-[12px] text-muted-foreground">{l.partyLabel}</span> : null}
                </span>
                <span>
                  <Badge tone={TYPE_TONE[l.section]} dot>{TYPE_LABEL[l.section]}</Badge>
                </span>
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

function isNonZero(v: string): boolean {
  return !!v && Number(v) !== 0;
}
