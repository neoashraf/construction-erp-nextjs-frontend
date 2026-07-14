"use client";

import Link from "next/link";
import { Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentModeBadge } from "./PaymentModeBadge";
import { type PaymentSummary } from "../types";

/**
 * Payments list table (brief §Scope 4; spec §5; design "Payments" frame). One row per
 * payment; DRAFT rows link to the editor `/payments/[id]`, POSTED/CANCELLED rows link
 * to the viewer `/payments/[id]/view`. `Delete` is hidden on non-draft rows and for
 * actors lacking `payment:write`. Money is right-aligned + tabular; identifier cell is
 * the lime `accent-ink` link.
 */
export interface PartyMap {
  byId: Map<string, string>;
}

export function PaymentList({
  rows,
  isLoading,
  parties,
  canDelete,
  onDelete,
  deletingId,
}: {
  rows: PaymentSummary[];
  isLoading: boolean;
  parties: PartyMap;
  canDelete: boolean;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  if (isLoading && rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="payment-list-loading">
        <div className={cn(HEADER_GRID, "bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground")}>
          <span className="pl-4">Entry no.</span>
          <span>Party</span>
          <span>Date</span>
          <span>Mode</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Allocated</span>
          <span className="text-right">Unallocated</span>
          <span>Status</span>
          <span />
        </div>
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className={cn(HEADER_GRID, "border-t border-border py-4")}>
            <Skeleton className="mx-4 h-3 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-24 justify-self-end" />
            <Skeleton className="h-3 w-24 justify-self-end" />
            <Skeleton className="h-3 w-24 justify-self-end" />
            <Skeleton className="h-5 w-16 rounded-pill" />
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="payment-list">
      <div
        className={cn(
          HEADER_GRID,
          "sticky top-0 z-10 border-b border-border-strong bg-surface-2 py-3 text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        )}
        role="row"
      >
        <span className="pl-4">Entry no.</span>
        <span>Party</span>
        <span>Date</span>
        <span>Mode</span>
        <span className="pr-4 text-right">Amount</span>
        <span className="pr-4 text-right">Allocated</span>
        <span className="pr-4 text-right">Unallocated</span>
        <span>Status</span>
        <span className="pr-4 text-right">Actions</span>
      </div>
      {rows.map((r) => {
        const isDraft = r.status === "DRAFT";
        const href = isDraft ? `/payments/${r.id}` : `/payments/${r.id}/view`;
        const partyName = parties.byId.get(r.partyId) ?? `${r.partyId.slice(0, 8)} (name unavailable)`;
        return (
          <div
            key={r.id}
            className={cn(HEADER_GRID, "items-center border-b border-border py-3.5 text-[13px] text-foreground hover:bg-surface-2 last:border-b-0")}
            role="row"
            data-testid={`payment-row-${r.status}`}
          >
            <span className="pl-4">
              <Link
                href={href}
                className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                data-testid={`payment-row-link-${r.id}`}
              >
                {r.entryNo ?? "Draft"}
              </Link>
            </span>
            <span className="bn text-[13px] text-foreground [overflow-wrap:anywhere]">{partyName}</span>
            <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">{formatDate(r.paymentDate)}</span>
            <span>
              <PaymentModeBadge mode={r.paymentMode} />
            </span>
            <span
              className="pr-4 text-right font-mono tabular-nums text-foreground"
              aria-label={`Amount ${r.paymentAmount} taka`}
            >
              {formatMoney(r.paymentAmount)}
            </span>
            <span className="pr-4 text-right font-mono tabular-nums text-muted-foreground">
              {formatMoney(r.allocatedAmount)}
            </span>
            <span className="pr-4 text-right font-mono tabular-nums text-muted-foreground">
              {formatMoney(r.unallocatedAmount)}
            </span>
            <span>
              <PaymentStatusBadge status={r.status} />
            </span>
            <span className="pr-4 text-right">
              {isDraft && canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  disabled={deletingId === r.id}
                  aria-label={`Delete draft ${r.id}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-token text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink disabled:opacity-60"
                  data-testid={`payment-row-delete-${r.id}`}
                >
                  {deletingId === r.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const HEADER_GRID =
  "grid grid-cols-[1.1fr_1.8fr_0.8fr_0.9fr_1fr_1fr_1fr_0.9fr_0.5fr] gap-2";
