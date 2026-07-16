"use client";

import Link from "next/link";
import { ExternalLink, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { VoucherStatusBadge } from "./VoucherStatusBadge";
import { VoucherTypeBadge } from "./VoucherTypeBadge";
import { type AnyVoucherSummary } from "../types";

/**
 * Voucher list table (spec §5; FR-GEN-020; design "Vouchers.dc.html"). Columns
 * Type · Entry no · Date · Narration · Status · Amount · Actions. Read-only — no
 * post/reverse/edit affordance (spec §6). Row link routes DRAFT → editor,
 * POSTED/CANCELLED → read-only voucher screen; the type badge disambiguates contra
 * vs journal vs opening. Two-tier responsive: a grid "table" at ≥lg, a stacked card
 * list below lg (same convention as sales-ipc's IpcList).
 */
const GRID = "84px minmax(140px,1.1fr) 100px minmax(160px,2fr) 110px minmax(120px,1fr) 76px";
const MONEY_CLS = "font-mono text-[13px] tabular-nums text-foreground";

/**
 * Static sort-caret header (design "Vouchers.dc.html" table pattern). The list has no
 * backend sort param (contract 14 — always `voucherDate desc`) — this renders the
 * design's affordance for that one real order, without pretending other columns are
 * interactively sortable.
 */
function SortHead({ label, align = "left", active = false }: { label: string; align?: "left" | "right"; active?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
      {label}
      <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
        <span className={active ? "text-foreground" : "text-border-strong"}>▲</span>
        <span className="text-border-strong">▼</span>
      </span>
    </span>
  );
}

function href(r: AnyVoucherSummary): string {
  const isContra = r.voucherType === "CONTRA";
  const isOpening = r.voucherType === "OPENING";
  if (isOpening) return "/contra-journal/opening";
  const query = isContra ? "?type=contra" : "?type=journal";
  return `/contra-journal/vouchers/${r.id}${query}`;
}

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
        <div className="hidden overflow-x-auto lg:block">
          <div style={{ minWidth: 900 }}>
            <div className="grid items-center gap-2 bg-surface-2 px-4 py-3" style={{ gridTemplateColumns: GRID }}>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Type</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                <SortHead label="Entry no." />
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                <SortHead label="Date" active />
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Narration</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Status</span>
              <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
                <SortHead label="Amount" align="right" />
              </span>
              <span />
            </div>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="grid items-center gap-2 border-t border-border px-4 py-3.5" style={{ gridTemplateColumns: GRID }}>
                <Skeleton className="h-5 w-16 rounded-pill" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-5 w-16 rounded-pill" />
                <Skeleton className="h-3 w-24 justify-self-end" />
                <Skeleton className="h-4 w-4 justify-self-end" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="voucher-list">
      {/* >=lg table */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 900 }}>
          <div
            role="row"
            className="sticky top-0 z-10 grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 py-3"
            style={{ gridTemplateColumns: GRID }}
          >
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Type</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              <SortHead label="Entry no." />
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              <SortHead label="Date" active />
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Narration</span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Status</span>
            <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">
              <SortHead label="Amount" align="right" />
            </span>
            <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground">Actions</span>
          </div>
          {rows.map((r) => {
            const rowHref = href(r);
            return (
              <div
                key={r.id}
                role="row"
                data-testid={`voucher-row-${r.status}`}
                className="grid items-center gap-2 border-b border-border px-4 py-3.5 text-[13px] text-foreground last:border-b-0 hover:bg-surface-2"
                style={{ gridTemplateColumns: GRID }}
              >
                <span>
                  <VoucherTypeBadge type={r.voucherType} />
                </span>
                <span>
                  {r.entryNo ? (
                    <Link
                      href={rowHref}
                      className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                      data-testid={`voucher-row-link-${r.id}`}
                    >
                      {r.entryNo}
                    </Link>
                  ) : (
                    <span className="font-mono text-[13px] italic text-muted-foreground">Draft</span>
                  )}
                </span>
                <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">{formatDate(r.voucherDate)}</span>
                <span className="bn min-w-0 text-[13px] text-foreground [overflow-wrap:anywhere]" title={r.narration ?? undefined}>
                  {r.narration ?? "—"}
                </span>
                <span>
                  <VoucherStatusBadge status={r.status} />
                </span>
                <span className="text-right" data-testid={`voucher-row-amount-${r.id}`}>
                  <span className={cn(MONEY_CLS, "font-semibold")} aria-label={`Amount ${r.totalDebit} taka`}>
                    {formatMoney(r.totalDebit)}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-1">
                  <Link
                    href={rowHref}
                    className="inline-flex h-8 items-center rounded-token border border-border-strong bg-background px-3 text-[12.5px] font-semibold text-foreground hover:bg-surface-2"
                    data-testid={`voucher-row-open-${r.id}`}
                  >
                    Open
                  </Link>
                  {r.status !== "DRAFT" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Row actions"
                        className="grid h-8 w-8 place-items-center rounded-token text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-testid={`voucher-row-menu-${r.id}`}
                      >
                        <MoreVertical className="h-4 w-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem asChild>
                          <Link href={rowHref}>Open</Link>
                        </DropdownMenuItem>
                        {r.journalEntryId && (
                          <DropdownMenuItem asChild>
                            <Link href={`/ledger/entry-viewer?id=${r.journalEntryId}`}>
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                              View ledger entry
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg cards */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => {
          const rowHref = href(r);
          return (
            <Link
              key={r.id}
              href={rowHref}
              data-testid={`voucher-card-${r.status}`}
              className="border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <VoucherTypeBadge type={r.voucherType} />
                  {r.entryNo ? (
                    <span className="font-mono text-[13px] font-semibold text-accent-ink">{r.entryNo}</span>
                  ) : (
                    <span className="font-mono text-[13px] italic text-muted-foreground">Draft</span>
                  )}
                </div>
                <VoucherStatusBadge status={r.status} />
              </div>
              <div className="bn mt-1.5 text-[13px] text-foreground [overflow-wrap:anywhere]">{r.narration ?? "—"}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[12px] text-muted-foreground">{formatDate(r.voucherDate)}</span>
                <span className={cn(MONEY_CLS, "font-semibold")}>{formatMoney(r.totalDebit)}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
