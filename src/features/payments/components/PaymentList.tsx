"use client";

import Link from "next/link";
import { MoreHorizontal, Trash2, Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { formatMoneyOr } from "@/lib/money";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentModeBadge, paymentModeLabel } from "./PaymentModeBadge";
import { type PaymentSummary } from "../types";

/**
 * Payments list table (brief §Scope 4; spec §5; design "Payments" frame). Columns:
 * Number (two-line: link + mode) · Party · Date · Mode (pill) · Cheque/Txn ref ·
 * Total · Allocated · Unallocated · Status · row-kebab. DRAFT rows link to the editor
 * `/payments/[id]`, POSTED/CANCELLED to the viewer `/payments/[id]/view`. Money is
 * right-aligned + tabular (2-decimal, per design). ≥lg = table; <lg = stacked cards.
 */
export interface PartyMap {
  byId: Map<string, string>;
}

const GRID =
  "minmax(104px,1fr) minmax(112px,1.4fr) 84px 112px minmax(84px,0.9fr) minmax(96px,1fr) minmax(92px,0.95fr) minmax(96px,0.95fr) 92px 40px";
const MONEY = "font-mono text-[13px] tabular-nums";

// A money cell must never take the page down: a value the API omitted renders as an
// em-dash rather than throwing mid-render (decimal.js rejects undefined).
function money(v: string | null | undefined) {
  return formatMoneyOr(v, "—", { fractionDigits: 2 });
}

// Same rule for the party cell. `partyId` is legitimately null on an aggregate-liability
// payment (backend PaymentSummaryDto types it `string | null`), so it must never be
// dereferenced unconditionally — an em-dash beats a client-side exception.
function partyLabel(partyId: string | null | undefined, parties: PartyMap) {
  if (!partyId) return "—";
  return parties.byId.get(partyId) ?? `${partyId.slice(0, 8)} (name unavailable)`;
}

// /** A payment with no allocations may carry no payee (payment.schema §payee rule). */
// function partyLabel(parties: PartyMap, partyId: string | null) {
//   if (!partyId) return "—";
//   return parties.byId.get(partyId) ?? `${partyId.slice(0, 8)} (name unavailable)`;
// }

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
    return <LoadingTable />;
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="payment-list">
      {/* >=lg table */}
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 920 }}>
          <div
            role="row"
            className="sticky top-0 z-10 grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 py-3"
            style={{ gridTemplateColumns: GRID }}
          >
            <HeadCell><SortHead label="Number" dir="asc" /></HeadCell>
            <HeadCell>Party</HeadCell>
            <HeadCell><SortHead label="Date" /></HeadCell>
            <HeadCell>Mode</HeadCell>
            <HeadCell>Cheque / txn ref</HeadCell>
            <HeadCell align="right"><SortHead label="Total ৳" align="right" /></HeadCell>
            <HeadCell align="right"><SortHead label="Allocated ৳" align="right" /></HeadCell>
            <HeadCell align="right"><SortHead label="Unallocated ৳" align="right" /></HeadCell>
            <HeadCell>Status</HeadCell>
            <HeadCell align="right" srLabel="Actions" />
          </div>
          {rows.map((r) => {
            const isDraft = r.status === "DRAFT";
            const href = isDraft ? `/payments/${r.id}` : `/payments/${r.id}/view`;
            const partyName = partyLabel(r.partyId, parties);
            // Treat an absent remainder as "nothing outstanding" so the cell stays muted
            // rather than styling a NaN as an unallocated balance.
            const unallocatedZero = !r.unallocatedAmount || Number(r.unallocatedAmount) === 0;
            return (
              <div
                key={r.id}
                role="row"
                data-testid={`payment-row-${r.status}`}
                className="grid items-center gap-2 border-b border-border px-4 py-3.5 text-[13px] text-foreground last:border-b-0 hover:bg-surface-2"
                style={{ gridTemplateColumns: GRID }}
              >
                {/* Number — two-line: link (or Draft pill) + mode sub-line */}
                <span className="min-w-0">
                  {isDraft ? (
                    <Link href={href} className="inline-flex" data-testid={`payment-row-link-${r.id}`}>
                      <PaymentStatusBadge status="DRAFT" />
                    </Link>
                  ) : (
                    <Link
                      href={href}
                      className="font-mono text-[13px] font-semibold text-accent-ink hover:underline"
                      data-testid={`payment-row-link-${r.id}`}
                    >
                      {r.entryNo}
                    </Link>
                  )}
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    {paymentModeLabel(r.paymentMode)}
                  </span>
                </span>
                {/* Party */}
                <span className="bn min-w-0 truncate text-[13px] text-foreground" title={partyName}>
                  {partyName}
                </span>
                {/* Date */}
                <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  {formatDate(r.paymentDate)}
                </span>
                {/* Mode pill */}
                <span>
                  <PaymentModeBadge mode={r.paymentMode} />
                </span>
                {/* Cheque / txn ref */}
                <span className="min-w-0 truncate text-[12.5px] text-muted-foreground" title={r.chequeTxnRef ?? undefined}>
                  {r.chequeTxnRef || "—"}
                </span>
                {/* Total */}
                <span className="text-right" aria-label={`Amount ${r.paymentAmount} taka`}>
                  <span className={cn(MONEY, "font-semibold text-foreground")}>{money(r.paymentAmount)}</span>
                </span>
                {/* Allocated */}
                <span className="text-right">
                  <span className={cn(MONEY, "text-muted-foreground")}>{money(r.allocatedAmount)}</span>
                </span>
                {/* Unallocated — muted when zero, bold dark when a remainder exists */}
                <span className="text-right">
                  <span className={cn(MONEY, unallocatedZero ? "text-muted-foreground" : "font-semibold text-foreground")}>
                    {money(r.unallocatedAmount)}
                  </span>
                </span>
                {/* Status */}
                <span>
                  <PaymentStatusBadge status={r.status} />
                </span>
                {/* Row kebab */}
                <span className="flex justify-end">
                  <RowMenu
                    href={href}
                    isDraft={isDraft}
                    canDelete={canDelete}
                    deleting={deletingId === r.id}
                    onDelete={() => onDelete(r.id)}
                    id={r.id}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* <lg stacked cards */}
      <div className="flex flex-col lg:hidden">
        {rows.map((r) => {
          const isDraft = r.status === "DRAFT";
          const href = isDraft ? `/payments/${r.id}` : `/payments/${r.id}/view`;
          const partyName = partyLabel(r.partyId, parties);
          return (
            <div
              key={r.id}
              data-testid={`payment-card-${r.status}`}
              className="border-b border-border px-4 py-3.5 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-2">
                {isDraft ? (
                  <Link href={href} data-testid={`payment-card-link-${r.id}`}>
                    <PaymentStatusBadge status="DRAFT" />
                  </Link>
                ) : (
                  <Link
                    href={href}
                    className="font-mono text-[14px] font-semibold text-accent-ink hover:underline"
                    data-testid={`payment-card-link-${r.id}`}
                  >
                    {r.entryNo}
                  </Link>
                )}
                <PaymentStatusBadge status={r.status} />
              </div>
              <dl className="mt-2 space-y-1 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-right text-foreground">
                    {formatDate(r.paymentDate)} · {paymentModeLabel(r.paymentMode)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Party</dt>
                  <dd className="bn text-right text-foreground [overflow-wrap:anywhere]">{partyName}</dd>
                </div>
              </dl>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-[12.5px] text-muted-foreground">Total amount</span>
                <span className={cn(MONEY, "text-[15px] font-bold text-foreground")}>{money(r.paymentAmount)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowMenu({
  href,
  isDraft,
  canDelete,
  deleting,
  onDelete,
  id,
}: {
  href: string;
  isDraft: boolean;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
  id: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Row actions"
        disabled={deleting}
        className="grid h-8 w-8 place-items-center rounded-token text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        data-testid={`payment-row-menu-${id}`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={href} data-testid={`payment-row-open-${id}`}>
            {isDraft ? <Pencil className="mr-2 h-4 w-4" aria-hidden /> : <Eye className="mr-2 h-4 w-4" aria-hidden />}
            {isDraft ? "Edit draft" : "View payment"}
          </Link>
        </DropdownMenuItem>
        {isDraft && canDelete && (
          <DropdownMenuItem
            onSelect={onDelete}
            className="text-destructive-ink focus:bg-destructive-soft data-[highlighted]:bg-destructive-soft"
            data-testid={`payment-row-delete-${id}`}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            Delete draft
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeadCell({
  children,
  align = "left",
  srLabel,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  srLabel?: string;
}) {
  return (
    <span
      className={cn(
        "text-[10.5px] font-semibold uppercase tracking-[0.4px] text-muted-foreground",
        align === "right" && "text-right",
      )}
    >
      {srLabel ? <span className="sr-only">{srLabel}</span> : children}
    </span>
  );
}

function SortHead({ label, align = "left", dir }: { label: string; align?: "left" | "right"; dir?: "asc" | "desc" }) {
  return (
    <span className={cn("inline-flex items-center gap-1", align === "right" && "flex-row-reverse")}>
      {label}
      <span className="flex flex-col text-[8px] leading-[0.6]" aria-hidden>
        <span className={dir === "asc" ? "text-foreground" : "text-border-strong"}>▲</span>
        <span className={dir === "desc" ? "text-foreground" : "text-border-strong"}>▼</span>
      </span>
    </span>
  );
}

function LoadingTable() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface" data-testid="payment-list-loading">
      <div className="hidden overflow-x-auto lg:block">
        <div style={{ minWidth: 920 }}>
          <div
            className="grid items-center gap-2 border-b border-border-strong bg-surface-2 px-4 py-3"
            style={{ gridTemplateColumns: GRID }}
          >
            {["Number", "Party", "Date", "Mode", "Cheque / txn ref", "Total ৳", "Allocated ৳", "Unallocated ৳", "Status", ""].map(
              (h, i) => (
                <HeadCell key={i} align={i >= 5 && i <= 7 ? "right" : "left"}>
                  {h}
                </HeadCell>
              ),
            )}
          </div>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="grid items-center gap-2 border-b border-border px-4 py-4" style={{ gridTemplateColumns: GRID }}>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-14" />
              </div>
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-20 rounded-pill" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20 justify-self-end" />
              <Skeleton className="h-3 w-20 justify-self-end" />
              <Skeleton className="h-3 w-16 justify-self-end" />
              <Skeleton className="h-5 w-16 rounded-pill" />
              <Skeleton className="h-4 w-4 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col lg:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2 border-b border-border px-4 py-3.5 last:border-b-0">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-pill" />
            </div>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
