"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { queryKeys } from "@/lib/query/keys";
import { useAuthenticatedUser } from "@/providers/session-provider";
import { listAccountOptions, listPartyOptions, type AccountOption, type PartyOption } from "../api/masters";
import { type JournalLine, type JournalVoucher } from "../types";
import { VoucherStatusBadge } from "./VoucherStatusBadge";
import { BalancedIndicator } from "./BalancedIndicator";

/**
 * Already-posted read-only recap (spec §5/§6; design "Opening Journal.dc.html" —
 * "Already posted" frame). Replaces the assembly UI entirely once an OPENING
 * voucher exists for the company (FR-GEN-012). Shows entryNo + posted-at/by +
 * Entry-viewer link + the full grouped lines recap (Account balances · Party
 * balances (AR/AP) · Opening balance equity), matching the design's review table.
 *
 * The posted `JournalLine[]` only carries `accountId`/`partyId` (no display
 * labels), so account/party names + the AR-vs-AP/Asset-vs-Liability classification
 * are joined client-side against the accounts/parties masters (same
 * `classifyAccount` heuristic the journal editor's dimension cluster uses) — the
 * API contract does not embed denormalised names on posted lines.
 */
export function OpeningPostedRecap({ voucher }: { voucher: JournalVoucher }) {
  const user = useAuthenticatedUser();
  const scope = { companyId: user.companyId, financialYearId: user.financialYearId };
  const accountsQ = useQuery({
    queryKey: queryKeys.list("contra-journal", "accounts", scope, {}),
    queryFn: () => listAccountOptions(),
    staleTime: 60_000,
  });
  const partiesQ = useQuery({
    queryKey: queryKeys.list("contra-journal", "parties", scope, {}),
    queryFn: () => listPartyOptions(),
    staleTime: 60_000,
  });
  const accountsIndex = useMemo(() => new Map((accountsQ.data ?? []).map((a) => [a.id, a])), [accountsQ.data]);
  const partiesIndex = useMemo(() => new Map((partiesQ.data ?? []).map((p) => [p.id, p])), [partiesQ.data]);

  const totalDebit = voucher.lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
  const totalCredit = voucher.lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4);

  const equityLine = voucher.lines.find((l) => !l.partyId && accountsIndex.get(l.accountId)?.type === "EQUITY");
  const accountLines = voucher.lines.filter((l) => l !== equityLine && !l.partyId);
  const partyLines = voucher.lines.filter((l) => !!l.partyId);

  return (
    <div data-testid="opening-posted-recap">
      <div
        className="flex items-start gap-3 rounded-card border border-success-soft bg-success-soft/40 p-3.5"
        data-testid="opening-posted-notice"
        role="status"
      >
        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 flex-none text-success-ink" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-foreground">
          <strong className="font-semibold text-success-ink">Opening journal posted.</strong>{" "}
          Corrections are made by reversing this entry from the voucher screen and posting a
          corrected opening journal — never a second one.
        </p>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-start gap-6">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Entry no.</div>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="info" className="font-mono">{voucher.entryNo ?? ""}</Badge>
              <VoucherStatusBadge status={voucher.status} />
            </div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Voucher date</div>
            <div className="mt-1 font-mono text-[13px] tabular-nums text-foreground">{formatDate(voucher.voucherDate)}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Posted</div>
            <div className="mt-1 font-mono text-[13px] tabular-nums text-foreground">
              {voucher.postedAt ? formatDateTime(voucher.postedAt) : "—"}
            </div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-1 text-[12.5px]">
            <span className="text-muted-foreground">
              Σ Dr <span className="font-mono tabular-nums text-foreground">{formatMoney(totalDebit)}</span>
            </span>
            <span className="text-muted-foreground">
              Σ Cr <span className="font-mono tabular-nums text-foreground">{formatMoney(totalCredit)}</span>
            </span>
          </div>
        </div>
        {voucher.journalEntryId && (
          <Link
            href={`/ledger/entry-viewer?id=${voucher.journalEntryId}`}
            className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-ink hover:underline"
            data-testid="opening-view-ledger"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View ledger entry
          </Link>
        )}
      </Card>

      <div className="mt-4 overflow-hidden rounded-card border border-border bg-surface" data-testid="opening-posted-lines">
        <div className="grid grid-cols-[60px_1.6fr_1fr_1fr_1fr] gap-2 bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
          <span className="pl-4">Line</span>
          <span>Account / Party</span>
          <span>Type</span>
          <span className="pr-4 text-right">Debit</span>
          <span className="pr-4 text-right">Credit</span>
        </div>
        {accountLines.length > 0 && (
          <RecapGroup title="Account balances" lines={accountLines} lineNoOffset={0} accountsIndex={accountsIndex} partiesIndex={partiesIndex} />
        )}
        {partyLines.length > 0 && (
          <RecapGroup title="Party balances (AR / AP)" lines={partyLines} lineNoOffset={accountLines.length} accountsIndex={accountsIndex} partiesIndex={partiesIndex} />
        )}
        {equityLine && (
          <RecapGroup title="Opening balance equity" lines={[equityLine]} lineNoOffset={accountLines.length + partyLines.length} accountsIndex={accountsIndex} partiesIndex={partiesIndex} />
        )}
        <div className="grid grid-cols-[60px_1.6fr_1fr_1fr_1fr] gap-2 border-t-2 border-border-strong bg-surface-2 py-3 text-[13px] font-bold text-foreground">
          <span />
          <span className="pl-4">Total</span>
          <span />
          <span className="pr-4 text-right font-mono tabular-nums">{formatMoney(totalDebit)}</span>
          <span className="pr-4 text-right font-mono tabular-nums">{formatMoney(totalCredit)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3" data-testid="opening-posted-footer">
          <BalancedIndicator debit={totalDebit} credit={totalCredit} balanced posted diff="0.0000" />
          {voucher.journalEntryId && (
            <>
              <span className="text-[12.5px] text-muted-foreground">
                Ledger entry <span className="font-mono font-semibold text-foreground">{voucher.entryNo}</span>
              </span>
              <Link
                href={`/ledger/entry-viewer?id=${voucher.journalEntryId}`}
                className="ml-auto inline-flex items-center gap-1 rounded-token border border-border-strong bg-background px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-surface-2"
                data-testid="opening-posted-open-in-entry-viewer"
              >
                Open in Entry viewer
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RecapGroup({
  title,
  lines,
  lineNoOffset,
  accountsIndex,
  partiesIndex,
}: {
  title: string;
  lines: JournalLine[];
  lineNoOffset: number;
  accountsIndex: Map<string, AccountOption>;
  partiesIndex: Map<string, PartyOption>;
}) {
  return (
    <section role="rowgroup">
      <h2 className="border-y border-border bg-surface-2/80 px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.4px] text-foreground">
        {title}
      </h2>
      {lines.map((l, i) => {
        const account = accountsIndex.get(l.accountId);
        const party = l.partyId ? partiesIndex.get(l.partyId) : undefined;
        const isAr = !!l.partyId && Number(l.debit) > 0;
        const tone = party ? (isAr ? "success" : "destructive") : account?.type === "EQUITY" ? "accent" : "info";
        const label = party ? (isAr ? "AR control" : "AP control") : account?.type === "EQUITY" ? "Equity" : humanizeType(account);
        return (
          <div key={`${l.accountId}-${i}`} className="grid grid-cols-[60px_1.6fr_1fr_1fr_1fr] items-center gap-2 border-b border-border py-3 text-[13px] text-foreground last:border-b-0">
            <span className="pl-4 font-mono text-[12px] text-muted-foreground">{lineNoOffset + i + 1}</span>
            <span className="bn [overflow-wrap:anywhere]">
              <span>{account ? `${account.code} · ${account.name}` : l.accountId}</span>
              {party && <span className="block text-[12px] text-muted-foreground">{party.name}</span>}
            </span>
            <span><Badge tone={tone} dot>{label}</Badge></span>
            <span className="pr-4 text-right font-mono tabular-nums">{Number(l.debit) > 0 ? formatMoney(l.debit) : "—"}</span>
            <span className={cn("pr-4 text-right font-mono tabular-nums")}>{Number(l.credit) > 0 ? formatMoney(l.credit) : "—"}</span>
          </div>
        );
      })}
    </section>
  );
}

function humanizeType(a?: AccountOption): string {
  if (!a) return "Account";
  const label = a.type.charAt(0) + a.type.slice(1).toLowerCase();
  return label;
}
