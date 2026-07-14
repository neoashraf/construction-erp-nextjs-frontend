"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { type JournalVoucher } from "../types";
import { VoucherStatusBadge } from "./VoucherStatusBadge";

/**
 * Already-posted read-only recap (spec §5/§6). Replaces the assembly UI entirely
 * once an OPENING voucher exists for the company (FR-GEN-012). Shows the grouped
 * lines recap + entryNo + posted-at/by + Entry-viewer link + the "reverse this
 * entry and post a corrected one" note.
 */
export function OpeningPostedRecap({ voucher }: { voucher: JournalVoucher }) {
  const totalDebit = voucher.lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(4);
  const totalCredit = voucher.lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(4);
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
    </div>
  );
}
