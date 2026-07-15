"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { VoucherStatusBadge } from "./VoucherStatusBadge";
import { VoucherTypeBadge } from "./VoucherTypeBadge";
import { type AnyVoucherSummary } from "../types";

/**
 * Voucher list table (spec §5; FR-GEN-020). Columns Type · Entry no · Date · Narration ·
 * Status · Amount · Actions. Read-only — no post/reverse/edit affordance (spec §6).
 * Row link routes DRAFT → editor, POSTED/CANCELLED → read-only voucher screen; the
 * type badge disambiguates contra vs journal vs opening (each has its own route family
 * built by FE-49/FE-50/FE-51 — until those land the link 404s, per the "unbuilt items
 * render de-emphasised" nav convention).
 */
const GRID = "grid grid-cols-[100px_1.2fr_0.9fr_2fr_0.9fr_1fr_0.5fr] gap-2";

export function VoucherList({
  rows,
  isLoading,
}: {
  rows: AnyVoucherSummary[];
  isLoading: boolean;
}) {
  if (isLoading && rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="voucher-list-loading">
        <div className={cn(GRID, "bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground")}>
          <span className="pl-4">Type</span>
          <span>Entry no.</span>
          <span>Date</span>
          <span>Narration</span>
          <span>Status</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className={cn(GRID, "border-t border-border py-4")}>
            <Skeleton className="ml-4 h-5 w-16 rounded-pill" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-3 w-24 justify-self-end" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="voucher-list">
      <div
        className={cn(
          GRID,
          "sticky top-0 z-10 border-b border-border-strong bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        )}
        role="row"
      >
        <span className="pl-4">Type</span>
        <span>Entry no.</span>
        <span>Date</span>
        <span>Narration</span>
        <span>Status</span>
        <span className="pr-4 text-right">Amount</span>
        <span className="pr-4 text-right">Actions</span>
      </div>
      {rows.map((r) => {
        const isDraft = r.status === "DRAFT";
        const isContra = r.voucherType === "CONTRA";
        const isOpening = r.voucherType === "OPENING";
        const routeBase = isContra
          ? "/contra-journal/vouchers"
          : isOpening
            ? "/contra-journal/opening"
            : "/contra-journal/vouchers";
        const query = isContra
          ? `?type=contra`
          : isOpening
            ? ""
            : `?type=journal`;
        const href = isOpening
          ? `${routeBase}/${r.id}`
          : isDraft
            ? `${routeBase}/${r.id}${query}`
            : `${routeBase}/${r.id}/view${query}`;
        return (
          <div
            key={r.id}
            className={cn(GRID, "items-center border-b border-border py-3.5 text-[13px] text-foreground hover:bg-surface-2 last:border-b-0")}
            role="row"
            data-testid={`voucher-row-${r.status}`}
          >
            <span className="pl-4">
              <VoucherTypeBadge type={r.voucherType} />
            </span>
            <span>
              <Link
                href={href}
                className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                data-testid={`voucher-row-link-${r.id}`}
              >
                {r.entryNo ?? "Draft"}
              </Link>
            </span>
            <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">{formatDate(r.voucherDate)}</span>
            <span className="bn text-[13px] text-foreground [overflow-wrap:anywhere]" title={r.narration ?? undefined}>
              {r.narration ?? "—"}
            </span>
            <span>
              <VoucherStatusBadge status={r.status} />
            </span>
            <span
              className="pr-4 text-right font-mono tabular-nums text-foreground"
              aria-label={`Amount ${r.totalDebit} taka`}
              data-testid={`voucher-row-amount-${r.id}`}
            >
              {formatMoney(r.totalDebit)}
            </span>
            <span className="pr-4 text-right">
              {r.journalEntryId && (
                <Link
                  href={`/ledger/entry-viewer?id=${r.journalEntryId}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-token text-muted-foreground hover:bg-surface-2 hover:text-accent-ink"
                  aria-label={`Ledger entry ${r.entryNo}`}
                  data-testid={`voucher-row-ledger-${r.id}`}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
